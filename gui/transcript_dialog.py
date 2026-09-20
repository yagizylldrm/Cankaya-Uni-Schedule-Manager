import os
from gui.qt_compat import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QScrollArea,
    QWidget, QFrame, QLineEdit, QComboBox, QTableWidget, QTableWidgetItem,
    QHeaderView, QTextEdit, QMessageBox, QGroupBox, QCompleter,
    Qt, ALIGN_CENTER, ALIGN_LEFT, NO_EDIT_TRIGGERS, ITEM_ENABLED, POINTING_HAND_CURSOR, pyqtSignal,
    CASE_INSENSITIVE, MATCH_CONTAINS
)
from gui.styles import StyleManager
from transcript_parser import TranscriptParser
from prerequisite_manager import PrerequisiteManager

class TranscriptDialog(QDialog):
    """
    Dialog for pasting student transcripts from Oasis or selecting passed courses,
    extracting completed courses, department, and minor/double major,
    and managing student's completed curriculum for prerequisite checking.
    """
    transcript_updated = pyqtSignal()

    def get_department_options(self):
        seen = {}
        if hasattr(self.data_manager, "official_curricula"):
            for code, curr in self.data_manager.official_curricula.items():
                p_name = curr.get("program_name", "")
                seen[code] = f"{code} - {p_name}" if p_name else f"{code} Bölümü"
        for code, name in self.data_manager.DEPARTMENT_NAMES.items():
            if code not in seen:
                seen[code] = f"{code} - {name}"
        return sorted([(k, v) for k, v in seen.items()], key=lambda x: x[0])

    GRADES = ["AA", "BA", "BB", "CB", "CC", "DC", "DD", "S", "P"]

    def __init__(self, data_manager, parent=None):
        super().__init__(parent)
        self.data_manager = data_manager
        self.detected_data = {
            "primary_dept": self.data_manager.student_profile.get("primary_dept", "CENG"),
            "secondary_dept": self.data_manager.student_profile.get("secondary_dept", "YOK"),
            "secondary_type": self.data_manager.student_profile.get("secondary_type", "YOK"),
            "passed_courses": dict(self.data_manager.get_passed_courses()),
            "failed_courses": {}
        }
        self.init_ui()

    def init_ui(self):
        is_dark = StyleManager.get_active_theme() == "modern"
        self.setWindowTitle("Transkript & Ön Koşul Yönetimi")
        self.setMinimumWidth(700)
        self.setMinimumHeight(620)
        self.resize(760, 680)

        dialog_bg = "#1e1e2e" if is_dark else "#f8fafc"
        dialog_text = "#cdd6f4" if is_dark else "#0f172a"
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {dialog_bg};
                color: {dialog_text};
            }}
        """)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(16, 16, 16, 16)
        main_layout.setSpacing(12)

        # 1. Header Banner
        header_frame = QFrame()
        h_bg = "#24273a" if is_dark else "#e0f2fe"
        h_border = "#89b4fa" if is_dark else "#0284c7"
        header_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {h_bg};
                border: 2px solid {h_border};
                border-radius: 8px;
                padding: 6px;
            }}
        """)
        h_layout = QVBoxLayout(header_frame)
        h_layout.setContentsMargins(10, 6, 10, 6)
        h_layout.setSpacing(2)

        h_title_color = "#89b4fa" if is_dark else "#0369a1"
        lbl_title = QLabel("<b>TRANSKRİPT & ÖN KOŞUL YÖNETİMİ</b>")
        lbl_title.setStyleSheet(f"color: {h_title_color}; font-size: 14px;")
        lbl_desc = QLabel(
            "Oasis'ten kopyaladığınız transkript metnini yapıştırarak veya verilen dersleri listeden seçerek sisteme aktarın.\n"
            "Program oluşturucu, derslerin ön koşullarını (prerequisite) otomatik kontrol ederek sadece alabileceğiniz dersleri listeler."
        )
        lbl_desc.setStyleSheet(f"color: {'#cdd6f4' if is_dark else '#334155'}; font-size: 11px;")
        lbl_desc.setWordWrap(True)
        h_layout.addWidget(lbl_title)
        h_layout.addWidget(lbl_desc)
        main_layout.addWidget(header_frame)

        # 2. Input Method Buttons (Tabs)
        mode_box = QHBoxLayout()
        mode_box.setSpacing(8)

        self.btn_tab_paste = QPushButton("Oasis Metin Yapıştır")
        self.btn_tab_paste.setCursor(POINTING_HAND_CURSOR)
        self.btn_tab_paste.clicked.connect(lambda: self.switch_tab(0))

        self.btn_tab_manual = QPushButton("Verilen Dersler Listesi")
        self.btn_tab_manual.setCursor(POINTING_HAND_CURSOR)
        self.btn_tab_manual.clicked.connect(lambda: self.switch_tab(1))

        mode_box.addWidget(self.btn_tab_paste)
        mode_box.addWidget(self.btn_tab_manual)
        main_layout.addLayout(mode_box)

        # 3. Stacked Container for the 2 tabs
        self.container_paste = QFrame()
        self.setup_paste_tab(self.container_paste, is_dark)
        main_layout.addWidget(self.container_paste)

        self.container_manual = QFrame()
        self.setup_manual_tab(self.container_manual, is_dark)
        self.container_manual.hide()
        main_layout.addWidget(self.container_manual)

        # 4. Analysis & Profile Summary Box
        summary_group = QGroupBox("Öğrenci ve Transkript Bilgileri")
        summary_group.setStyleSheet(f"""
            QGroupBox {{
                font-weight: bold;
                font-size: 12px;
                border: 1px solid {'#45475a' if is_dark else '#cbd5e1'};
                border-radius: 6px;
                margin-top: 6px;
                padding-top: 10px;
                background-color: {'#181825' if is_dark else '#ffffff'};
            }}
            QGroupBox::title {{
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 4px;
                color: {'#89b4fa' if is_dark else '#002855'};
            }}
        """)
        sum_layout = QVBoxLayout(summary_group)
        sum_layout.setSpacing(8)

        # Row 1: Primary Dept and Secondary Program
        row1 = QHBoxLayout()
        row1.setSpacing(12)

        dept_options = self.get_department_options()

        lbl_p_dept = QLabel("<b>Ana Bölüm:</b>")
        self.combo_primary = QComboBox()
        for code, label in dept_options:
            self.combo_primary.addItem(label, code)
        self.set_combo_value(self.combo_primary, self.detected_data["primary_dept"])
        self.combo_primary.currentIndexChanged.connect(self.on_primary_dept_changed)
        row1.addWidget(lbl_p_dept)
        row1.addWidget(self.combo_primary, 1)

        lbl_s_type = QLabel("<b>İkinci Program:</b>")
        self.combo_sec_type = QComboBox()
        self.combo_sec_type.addItem("Yok", "YOK")
        self.combo_sec_type.addItem("Yandal", "YANDAL")
        self.combo_sec_type.addItem("Çift Anadal (ÇAP)", "CAP")
        self.set_combo_value(self.combo_sec_type, self.detected_data["secondary_type"])
        row1.addWidget(lbl_s_type)
        row1.addWidget(self.combo_sec_type)

        self.combo_sec_dept = QComboBox()
        self.combo_sec_dept.addItem("Yok", "YOK")
        for code, label in dept_options:
            self.combo_sec_dept.addItem(label, code)
        self.set_combo_value(self.combo_sec_dept, self.detected_data["secondary_dept"])
        row1.addWidget(self.combo_sec_dept, 1)

        sum_layout.addLayout(row1)

        # Row 2: Badges
        row2 = QHBoxLayout()
        self.lbl_stat_passed = QLabel("<b>Verilen Ders Sayısı:</b> 0")
        self.lbl_stat_passed.setStyleSheet("color: #10b981; font-size: 12px;")
        row2.addWidget(self.lbl_stat_passed)

        self.lbl_stat_failed = QLabel("<b>Başarısız / Tekrar:</b> 0")
        self.lbl_stat_failed.setStyleSheet("color: #f59e0b; font-size: 12px;")
        row2.addWidget(self.lbl_stat_failed)
        row2.addStretch()
        sum_layout.addLayout(row2)

        # Row 3: Curriculum Progress
        row3 = QHBoxLayout()
        self.lbl_stat_curriculum = QLabel("<b>Müfredat:</b> Hesaplanıyor...")
        self.lbl_stat_curriculum.setStyleSheet("color: #89b4fa; font-size: 11px;")
        self.lbl_stat_curriculum.setWordWrap(True)
        row3.addWidget(self.lbl_stat_curriculum)
        sum_layout.addLayout(row3)

        main_layout.addWidget(summary_group)

        # 5. Bottom Action Buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        btn_cancel = QPushButton("İptal")
        btn_cancel.setFixedWidth(100)
        btn_cancel.setStyleSheet(f"""
            QPushButton {{
                background-color: {'#313244' if is_dark else '#e2e8f0'};
                color: {'#cdd6f4' if is_dark else '#1e293b'};
                border: 1px solid {'#45475a' if is_dark else '#cbd5e1'};
                border-radius: 4px;
                padding: 6px 14px;
                font-size: 12px;
            }}
            QPushButton:hover {{
                background-color: {'#45475a' if is_dark else '#cbd5e1'};
            }}
        """)
        btn_cancel.clicked.connect(self.reject)
        btn_layout.addWidget(btn_cancel)

        btn_save = QPushButton("Kaydet ve Profili Güncelle")
        btn_save.setObjectName("primaryButton")
        btn_save.setFixedWidth(220)
        btn_save.setStyleSheet(f"""
            QPushButton {{
                background-color: {'#3b82f6' if is_dark else '#002855'};
                color: #ffffff;
                border: none;
                border-radius: 4px;
                padding: 6px 16px;
                font-size: 12px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: {'#2563eb' if is_dark else '#d49a17'};
            }}
        """)
        btn_save.clicked.connect(self.save_and_apply)
        btn_layout.addWidget(btn_save)

        main_layout.addLayout(btn_layout)

        self.switch_tab(0)
        self.update_summary_display()

    def set_combo_value(self, combo, value):
        for i in range(combo.count()):
            if combo.itemData(i) == value:
                combo.setCurrentIndex(i)
                return

    def switch_tab(self, index):
        is_dark = StyleManager.get_active_theme() == "modern"
        active_style = f"""
            QPushButton {{
                background-color: {'#3b82f6' if is_dark else '#002855'};
                color: #ffffff;
                border: none;
                border-radius: 6px;
                padding: 6px 14px;
                font-weight: bold;
                font-size: 12px;
            }}
        """
        inactive_style = f"""
            QPushButton {{
                background-color: {'#313244' if is_dark else '#e2e8f0'};
                color: {'#cdd6f4' if is_dark else '#1e293b'};
                border: 1px solid {'#45475a' if is_dark else '#cbd5e1'};
                border-radius: 6px;
                padding: 6px 14px;
                font-size: 12px;
            }}
            QPushButton:hover {{
                background-color: {'#45475a' if is_dark else '#cbd5e1'};
            }}
        """
        self.btn_tab_paste.setStyleSheet(active_style if index == 0 else inactive_style)
        self.btn_tab_manual.setStyleSheet(active_style if index == 1 else inactive_style)

        self.container_paste.setVisible(index == 0)
        self.container_manual.setVisible(index == 1)

    def setup_paste_tab(self, parent, is_dark):
        layout = QVBoxLayout(parent)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

        lbl_help = QLabel("<b>Oasis Transkript Sayfasından Kopyala-Yapıştır:</b>")
        lbl_help.setStyleSheet(f"color: {'#89b4fa' if is_dark else '#002855'}; font-size: 11px;")
        layout.addWidget(lbl_help)

        self.txt_paste = QTextEdit()
        self.txt_paste.setPlaceholderText(
            "Oasis'teki transkript sayfasından aldığınız ders tablosunu buraya yapıştırın...\n"
            "Örnek format:\n"
            "CENG 111 Introduction to Programming AA 3.0 5.0\n"
            "MATH 157 Calculus I BA 4.0 6.0\n"
            "PHYS 131 General Physics I BB 4.0 6.0"
        )
        self.txt_paste.setStyleSheet(f"""
            QTextEdit {{
                background-color: {'#181825' if is_dark else '#ffffff'};
                color: {'#cdd6f4' if is_dark else '#0f172a'};
                border: 1px solid {'#45475a' if is_dark else '#cbd5e1'};
                border-radius: 6px;
                font-family: monospace;
                font-size: 11px;
                padding: 6px;
            }}
        """)
        layout.addWidget(self.txt_paste)

        btn_parse_text = QPushButton("Metni Ayrıştır ve Yükle")
        btn_parse_text.setCursor(POINTING_HAND_CURSOR)
        btn_parse_text.setStyleSheet(f"""
            QPushButton {{
                background-color: {'#3b82f6' if is_dark else '#002855'};
                color: #ffffff;
                border: none;
                border-radius: 4px;
                padding: 6px 14px;
                font-size: 11px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: {'#2563eb' if is_dark else '#d49a17'};
            }}
        """)
        btn_parse_text.clicked.connect(self.parse_pasted_text)
        layout.addWidget(btn_parse_text, alignment=ALIGN_LEFT)

    def setup_manual_tab(self, parent, is_dark):
        layout = QVBoxLayout(parent)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

        # Quick Add Row
        add_row = QHBoxLayout()
        add_row.setSpacing(8)

        lbl_c = QLabel("<b>Ders Kodu / Adı:</b>")
        self.txt_manual_code = QLineEdit()
        self.txt_manual_code.setPlaceholderText("Ders kodu veya adı yazın (Örn: CENG111)...")
        self.txt_manual_code.setMinimumWidth(280)
        self.txt_manual_code.returnPressed.connect(self.add_manual_course)
        self.txt_manual_code.setStyleSheet(f"""
            QLineEdit {{
                background-color: {'#181825' if is_dark else '#ffffff'};
                color: {'#cdd6f4' if is_dark else '#0f172a'};
                border: 1px solid {'#45475a' if is_dark else '#cbd5e1'};
                border-radius: 4px;
                padding: 6px 10px;
                font-size: 11px;
            }}
            QLineEdit:focus {{
                border-color: {'#89b4fa' if is_dark else '#0284c7'};
            }}
        """)

        # Populate course completion list from catalog & prerequisite database & official curricula
        course_items = []
        for code in self.data_manager.courses.keys():
            norm_code = self.data_manager.normalize_code(code)
            info = self.data_manager.get_course_info(norm_code) or {}
            c_name = info.get("name", "")
            if c_name and c_name != norm_code:
                course_items.append(f"{norm_code} - {c_name}")
            else:
                course_items.append(norm_code)

        if hasattr(self.data_manager, "official_curricula"):
            for dept_code, curr in self.data_manager.official_curricula.items():
                for c in curr.get("compulsory_courses", []):
                    c_code = c.get("norm_code") or self.data_manager.normalize_code(c.get("code", ""))
                    c_name = c.get("name_tr") or c.get("name_en") or ""
                    item_str = f"{c_code} - {c_name}" if c_name else c_code
                    course_items.append(item_str)
                for c_code, c in curr.get("technical_elective_pool", {}).items():
                    norm_c = self.data_manager.normalize_code(c_code)
                    c_name = c.get("name_tr") or c.get("name_en") or ""
                    item_str = f"{norm_c} - {c_name}" if c_name else norm_c
                    course_items.append(item_str)
                for c_code, c in curr.get("social_elective_pool", {}).items():
                    norm_c = self.data_manager.normalize_code(c_code)
                    c_name = c.get("name_tr") or c.get("name_en") or ""
                    item_str = f"{norm_c} - {c_name}" if c_name else norm_c
                    course_items.append(item_str)

        for prereq_code in PrerequisiteManager.PREREQUISITE_DATABASE.keys():
            norm_p = self.data_manager.normalize_code(prereq_code)
            if not any(item.startswith(norm_p) for item in course_items):
                course_items.append(norm_p)

        course_items = sorted(list(set(course_items)))

        completer = QCompleter(course_items, self)
        completer.setCaseSensitivity(CASE_INSENSITIVE)
        completer.setFilterMode(MATCH_CONTAINS)
        self.txt_manual_code.setCompleter(completer)

        lbl_g = QLabel("<b>Not:</b>")
        self.combo_manual_grade = QComboBox()
        self.combo_manual_grade.addItems(self.GRADES)
        self.combo_manual_grade.setFixedWidth(70)

        btn_add = QPushButton("Ekle")
        btn_add.setCursor(POINTING_HAND_CURSOR)
        btn_add.setStyleSheet(f"""
            QPushButton {{
                background-color: {'#10b981' if is_dark else '#15803d'};
                color: #ffffff;
                border: none;
                border-radius: 4px;
                padding: 6px 14px;
                font-size: 11px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: {'#059669' if is_dark else '#166534'};
            }}
        """)
        btn_add.clicked.connect(self.add_manual_course)

        add_row.addWidget(lbl_c)
        add_row.addWidget(self.txt_manual_code, 1)
        add_row.addWidget(lbl_g)
        add_row.addWidget(self.combo_manual_grade)
        add_row.addWidget(btn_add)

        layout.addLayout(add_row)

        # Table of passed courses (Code, Name, Grade, Action)
        self.table_courses = QTableWidget(0, 4)
        self.table_courses.setHorizontalHeaderLabels(["Ders Kodu", "Ders Adı", "Harf Notu", "İşlem"])
        self.table_courses.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        self.table_courses.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.table_courses.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        self.table_courses.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        self.table_courses.setEditTriggers(NO_EDIT_TRIGGERS)
        self.table_courses.setStyleSheet(f"""
            QTableWidget {{
                background-color: {'#181825' if is_dark else '#ffffff'};
                color: {'#cdd6f4' if is_dark else '#0f172a'};
                border: 1px solid {'#45475a' if is_dark else '#cbd5e1'};
                border-radius: 6px;
            }}
        """)
        layout.addWidget(self.table_courses)

    def parse_pasted_text(self):
        text = self.txt_paste.toPlainText().strip()
        if not text:
            QMessageBox.warning(self, "Metin Boş", "Lütfen önce transkript metnini yapıştırın.")
            return

        parsed = TranscriptParser.parse_text(text)
        self.apply_parsed_results(parsed)
        QMessageBox.information(
            self,
            "Ayrıştırma Tamamlandı",
            f"Metinden toplam {len(parsed['passed_courses'])} verilen ders ve {len(parsed['failed_courses'])} başarısız ders tespit edildi!"
        )

    def apply_parsed_results(self, parsed):
        if parsed.get("primary_dept"):
            self.detected_data["primary_dept"] = parsed["primary_dept"]
            self.set_combo_value(self.combo_primary, parsed["primary_dept"])

        if parsed.get("secondary_type") and parsed["secondary_type"] != "YOK":
            self.detected_data["secondary_type"] = parsed["secondary_type"]
            self.set_combo_value(self.combo_sec_type, parsed["secondary_type"])

        if parsed.get("secondary_dept") and parsed["secondary_dept"] != "YOK":
            self.detected_data["secondary_dept"] = parsed["secondary_dept"]
            self.set_combo_value(self.combo_sec_dept, parsed["secondary_dept"])

        # Merge passed courses
        self.detected_data["passed_courses"].update(parsed.get("passed_courses", {}))
        self.detected_data["failed_courses"].update(parsed.get("failed_courses", {}))

        self.update_summary_display()
        self.update_manual_table()

    def add_manual_course(self):
        raw_text = self.txt_manual_code.text().strip()
        if not raw_text:
            return

        # If selected from completer: "CENG111 - Introduction to Programming" -> "CENG111"
        if " - " in raw_text:
            raw_code = raw_text.split(" - ")[0].strip()
        else:
            raw_code = raw_text.strip()

        norm = self.data_manager.normalize_code(raw_code.upper())
        if not norm:
            return

        grade = self.combo_manual_grade.currentText()
        info = self.data_manager.get_course_info(norm) or {}
        c_name = info.get("name", norm)

        self.detected_data["passed_courses"][norm] = {
            "code": norm,
            "grade": grade,
            "name": c_name
        }
        self.txt_manual_code.clear()
        self.update_summary_display()
        self.update_manual_table()

    def remove_course(self, code):
        if code in self.detected_data["passed_courses"]:
            del self.detected_data["passed_courses"][code]
            self.update_summary_display()
            self.update_manual_table()

    def update_manual_table(self):
        passed = self.detected_data["passed_courses"]
        self.table_courses.setRowCount(len(passed))

        for row, (code, info) in enumerate(sorted(passed.items())):
            item_code = QTableWidgetItem(code)
            item_code.setTextAlignment(ALIGN_LEFT)
            self.table_courses.setItem(row, 0, item_code)

            c_name = info.get("name", code) if isinstance(info, dict) else code
            if c_name == code:
                course_info = self.data_manager.get_course_info(code) or {}
                c_name = course_info.get("name", code)

            item_name = QTableWidgetItem(c_name)
            item_name.setTextAlignment(ALIGN_LEFT)
            self.table_courses.setItem(row, 1, item_name)

            grade = info.get("grade", "CC") if isinstance(info, dict) else str(info)
            item_grade = QTableWidgetItem(grade)
            item_grade.setTextAlignment(ALIGN_CENTER)
            self.table_courses.setItem(row, 2, item_grade)

            btn_del = QPushButton("Sil")
            btn_del.setCursor(POINTING_HAND_CURSOR)
            btn_del.setStyleSheet("""
                QPushButton {
                    background-color: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    padding: 2px 8px;
                    font-size: 10px;
                }
            """)
            btn_del.clicked.connect(lambda _, c=code: self.remove_course(c))
            self.table_courses.setCellWidget(row, 3, btn_del)

    def on_primary_dept_changed(self):
        p_dept = self.combo_primary.currentData()
        if p_dept:
            self.detected_data["primary_dept"] = p_dept
            self.update_summary_display()

    def update_summary_display(self):
        p_dept = self.combo_primary.currentData() or self.detected_data.get("primary_dept", "CENG")
        num_passed = len(self.detected_data["passed_courses"])
        num_failed = len(self.detected_data["failed_courses"])
        self.lbl_stat_passed.setText(f"<b>Verilen Ders Sayısı:</b> {num_passed}")
        self.lbl_stat_failed.setText(f"<b>Başarısız / Tekrar:</b> {num_failed}")

        # Calculate curriculum progress
        prog = self.data_manager.get_curriculum_progress(p_dept, self.detected_data["passed_courses"])
        comp_rem = prog.get("compulsory_remaining_count", 0)
        comp_tot = prog.get("compulsory_total", 0)
        tech_rem = prog.get("tech_slots_remaining", 0)
        tech_tot = prog.get("tech_slots_total", 0)
        soc_rem = prog.get("social_slots_remaining", 0)
        soc_tot = prog.get("social_slots_total", 0)

        is_dark = StyleManager.get_active_theme() == "modern"
        comp_col = "#10b981" if comp_rem == 0 else ("#f59e0b" if is_dark else "#d97706")
        tech_col = "#10b981" if tech_rem == 0 else ("#89b4fa" if is_dark else "#0284c7")
        soc_col = "#10b981" if soc_rem == 0 else ("#cba6f7" if is_dark else "#7c3aed")

        curr_text = (
            f"<b>Müfredat Durumu ({p_dept}):</b> "
            f"<span style='color: {comp_col}; font-weight: bold;'>Kalan Zorunlu: {comp_rem}/{comp_tot}</span>  |  "
            f"<span style='color: {tech_col}; font-weight: bold;'>Kalan Teknik Seçmeli: {tech_rem}/{tech_tot}</span>  |  "
            f"<span style='color: {soc_col}; font-weight: bold;'>Kalan Sosyal Seçmeli: {soc_rem}/{soc_tot}</span>"
        )
        self.lbl_stat_curriculum.setText(curr_text)
        self.update_manual_table()

    def save_and_apply(self):
        # Read final values from UI
        p_dept = self.combo_primary.currentData()
        s_type = self.combo_sec_type.currentData()
        s_dept = self.combo_sec_dept.currentData()

        if s_type == "YOK":
            s_dept = "YOK"

        self.data_manager.save_student_profile(
            primary_dept=p_dept,
            secondary_dept=s_dept,
            secondary_type=s_type
        )
        self.data_manager.set_passed_courses(self.detected_data["passed_courses"])

        self.transcript_updated.emit()
        QMessageBox.information(
            self,
            "Profil Güncellendi",
            f"Transkript verileri başarıyla kaydedildi!\n\n"
            f"• Ana Bölüm: {p_dept}\n"
            f"• İkinci Program: {s_type} ({s_dept})\n"
            f"• Kayıtlı Verilen Ders: {len(self.detected_data['passed_courses'])}\n\n"
            f"Ders arama paneli ve ön koşul denetimleri güncellenmiştir."
        )
        self.accept()
