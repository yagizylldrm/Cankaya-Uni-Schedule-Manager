from gui.qt_compat import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QComboBox,
    QListWidget, QListWidgetItem, QPushButton, QGroupBox, QTreeWidget,
    QTreeWidgetItem, QMessageBox, QCheckBox, Qt, pyqtSignal,
    SINGLE_SELECTION, USER_ROLE, CHECKED, UNCHECKED, PARTIALLY_CHECKED,
    QMenu, CUSTOM_CONTEXT_MENU, QDialog, QFrame, QColor
)
from gui.styles import ModernStyle, CankayaStyle, StyleManager

# Try importing QCompleter
try:
    from PySide6.QtWidgets import QCompleter
except ImportError:
    try:
        from PyQt6.QtWidgets import QCompleter
    except ImportError:
        from PyQt5.QtWidgets import QCompleter

class CreditEditDialog(QDialog):
    """Dialog to edit local credit and ECTS for a specific course."""
    def __init__(self, course_code, current_credit, current_ects, parent=None):
        super().__init__(parent)
        self.course_code = course_code
        self.setWindowTitle(f"Kredi Düzenle - {course_code}")
        self.setFixedWidth(320)
        self.result_credit = current_credit
        self.result_ects = current_ects
        self.init_ui(current_credit, current_ects)

    def init_ui(self, current_credit, current_ects):
        layout = QVBoxLayout(self)
        layout.setSpacing(12)

        lbl_info = QLabel(f"<b>{self.course_code}</b> dersi için kredi bilgilerini güncelleyin:")
        lbl_info.setStyleSheet("color: #cdd6f4; font-size: 12px;")
        layout.addWidget(lbl_info)

        # Yerel Kredi
        h1 = QHBoxLayout()
        lbl_cr = QLabel("Yerel Kredi:")
        lbl_cr.setStyleSheet("font-weight: bold; color: #89b4fa;")
        self.txt_credit = QLineEdit(str(current_credit))
        h1.addWidget(lbl_cr)
        h1.addWidget(self.txt_credit)
        layout.addLayout(h1)

        # AKTS Kredisi
        h2 = QHBoxLayout()
        lbl_ec = QLabel("AKTS Kredisi:")
        lbl_ec.setStyleSheet("font-weight: bold; color: #cba6f7;")
        self.txt_ects = QLineEdit(str(current_ects))
        h2.addWidget(lbl_ec)
        h2.addWidget(self.txt_ects)
        layout.addLayout(h2)

        # Buttons
        btn_layout = QHBoxLayout()
        btn_cancel = QPushButton("İptal")
        btn_cancel.clicked.connect(self.reject)
        btn_save = QPushButton("Kaydet")
        btn_save.setObjectName("primaryButton")
        btn_save.clicked.connect(self.on_save)
        btn_layout.addWidget(btn_cancel)
        btn_layout.addWidget(btn_save)
        layout.addLayout(btn_layout)

    def on_save(self):
        try:
            cr = int(self.txt_credit.text().strip())
            ec = int(self.txt_ects.text().strip())
            if cr < 0 or ec < 0:
                raise ValueError()
            self.result_credit = cr
            self.result_ects = ec
            self.accept()
        except ValueError:
            QMessageBox.warning(self, "Hata", "Lütfen geçerli pozitif tam sayı değerleri girin.")


class CourseSearchPanel(QWidget):
    courses_changed = pyqtSignal()

    def __init__(self, data_manager, parent=None):
        super().__init__(parent)
        self.data_manager = data_manager
        self.basket_courses = {}
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        # 1. STUDENT PROFILE GROUP (Bölüm & Yandal / Çift Anadal)
        profile_group = QGroupBox("Öğrenci Bölüm Bilgileri")
        profile_layout = QVBoxLayout(profile_group)
        profile_layout.setSpacing(6)

        # Primary Major
        # Primary Major
        p_layout = QHBoxLayout()
        self.lbl_p = QLabel("Ana Bölüm:")
        self.combo_primary = QComboBox()
        self.combo_primary.currentIndexChanged.connect(self.on_profile_changed)
        p_layout.addWidget(self.lbl_p)
        p_layout.addWidget(self.combo_primary)
        profile_layout.addLayout(p_layout)

        # Second Program Type (None / Double Major ÇAP / Minor Yandal)
        st_layout = QHBoxLayout()
        self.lbl_st = QLabel("İkinci Program:")
        self.combo_sec_type = QComboBox()
        self.combo_sec_type.addItem("YOK (Tek Ana Dal)", "YOK")
        self.combo_sec_type.addItem("🟣 Çift Anadal (ÇAP)", "CAP")
        self.combo_sec_type.addItem("🔵 Yandal (Minor)", "YANDAL")
        self.combo_sec_type.currentIndexChanged.connect(self.on_sec_type_changed)
        st_layout.addWidget(self.lbl_st)
        st_layout.addWidget(self.combo_sec_type)
        profile_layout.addLayout(st_layout)

        # Secondary Major (Minor / Double Major Department)
        s_layout = QHBoxLayout()
        self.lbl_sec_dept = QLabel("İkinci Bölüm:")
        self.combo_secondary = QComboBox()
        self.combo_secondary.currentIndexChanged.connect(self.on_profile_changed)
        s_layout.addWidget(self.lbl_sec_dept)
        s_layout.addWidget(self.combo_secondary)
        profile_layout.addLayout(s_layout)

        layout.addWidget(profile_group)

        # 2. SEARCH & FILTER GROUP
        search_group = QGroupBox("Ders Arama & Filtreleme")
        search_layout = QVBoxLayout(search_group)
        search_layout.setSpacing(8)

        # Searchable Department / Course Code Filter
        dept_layout = QHBoxLayout()
        dept_layout.addWidget(QLabel("Ders Kodu/Bölüm:"))
        self.combo_dept = QComboBox()
        self.combo_dept.setEditable(True)
        self.combo_dept.setInsertPolicy(QComboBox.InsertPolicy.NoInsert if hasattr(QComboBox, 'InsertPolicy') else QComboBox.NoInsert)
        self.combo_dept.lineEdit().setPlaceholderText("Kod yazıp arayın...")
        
        # Setup completer for fast autocomplete inside course code filter
        completer = QCompleter()
        completer.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive if hasattr(Qt, 'CaseSensitivity') else Qt.CaseInsensitive)
        completer.setFilterMode(Qt.MatchFlag.MatchContains if hasattr(Qt, 'MatchFlag') else Qt.MatchContains)
        self.combo_dept.setCompleter(completer)
        self.combo_dept.currentTextChanged.connect(self.on_search_changed)
        dept_layout.addWidget(self.combo_dept)
        search_layout.addLayout(dept_layout)

        # Course Type Filter (Zorunlu vs Seçmeli)
        type_layout = QHBoxLayout()
        type_layout.addWidget(QLabel("Ders Türü:"))
        self.combo_type = QComboBox()
        self.combo_type.addItem("Tüm Dersler", "TÜMÜ")
        self.combo_type.addItem("Tüm Zorunlu Dersler", "ZORUNLU")
        self.combo_type.addItem("🔹 Sadece Ana Bölüm Zorunlu", "ZORUNLU_ANA")
        self.combo_type.addItem("🟣 Sadece ÇAP Zorunlu", "ZORUNLU_CAP")
        self.combo_type.addItem("🔵 Sadece Yandal Zorunlu", "ZORUNLU_YANDAL")
        self.combo_type.addItem("Tüm Seçmeli Dersler", "SECMELI")
        self.combo_type.addItem("🔹 Teknik / Bölüm Seçmeli", "TEKNIK_SECMELI")
        self.combo_type.addItem("🔸 Sosyal / Serbest Seçmeli", "SERBEST_SECMELI")
        self.combo_type.currentIndexChanged.connect(self.on_search_changed)
        type_layout.addWidget(self.combo_type)
        search_layout.addLayout(type_layout)

        # Text search input (Course Code / Instructor)
        self.txt_search = QLineEdit()
        self.txt_search.setPlaceholderText("Ders kodu veya öğretim elemanı ara...")
        self.txt_search.textChanged.connect(self.on_search_changed)
        search_layout.addWidget(self.txt_search)

        # Prerequisite Filters
        prereq_filter_layout = QHBoxLayout()
        self.chk_only_eligible = QCheckBox("🟢 Sadece Alabileceğim")
        self.chk_only_eligible.setToolTip("Yalnızca ön koşullarını sağladığınız dersleri listeler")
        self.chk_only_eligible.stateChanged.connect(self.on_search_changed)

        self.chk_hide_passed = QCheckBox("Verdiğim Dersleri Gizle")
        self.chk_hide_passed.setToolTip("Transkriptinizde daha önce başarıyla verdiğiniz dersleri arama listesinden gizler")
        self.chk_hide_passed.stateChanged.connect(self.on_search_changed)

        prereq_filter_layout.addWidget(self.chk_only_eligible)
        prereq_filter_layout.addWidget(self.chk_hide_passed)
        search_layout.addLayout(prereq_filter_layout)

        # Search Results List
        self.list_results = QListWidget()
        self.list_results.setSelectionMode(SINGLE_SELECTION)
        self.list_results.itemDoubleClicked.connect(self.add_selected_course_to_basket)
        self.list_results.setContextMenuPolicy(CUSTOM_CONTEXT_MENU)
        self.list_results.customContextMenuRequested.connect(self.show_results_context_menu)
        self.list_results.itemDoubleClicked.connect(self.open_selected_course_info)
        search_layout.addWidget(self.list_results)

        # Action Buttons for Search Results: Add + Info + Toggle Type
        btn_search_actions = QHBoxLayout()
        self.btn_add = QPushButton("Ekle")
        self.btn_add.setObjectName("primaryButton")
        self.btn_add.clicked.connect(self.add_selected_course_to_basket)
        btn_search_actions.addWidget(self.btn_add)

        self.btn_info = QPushButton("Bilgi")
        self.btn_info.setToolTip("Seçili dersin tanımını, içeriğini ve web sayfası bağlantılarını gösterir")
        self.btn_info.clicked.connect(self.open_selected_course_info)
        btn_search_actions.addWidget(self.btn_info)

        self.btn_toggle_type = QPushButton("Zorunlu/Seçmeli")
        self.btn_toggle_type.setToolTip("Seçili dersin Zorunlu ⇋ Seçmeli durumunu değiştirir")
        self.btn_toggle_type.clicked.connect(self.toggle_selected_course_type)
        btn_search_actions.addWidget(self.btn_toggle_type)
        search_layout.addLayout(btn_search_actions)

        layout.addWidget(search_group)

        # 3. TARGET COURSE BASKET GROUP
        basket_group = QGroupBox("Alınmak İstenen Dersler (Ders Sepeti)")
        basket_layout = QVBoxLayout(basket_group)

        self.tree_basket = QTreeWidget()
        self.tree_basket.setHeaderLabels(["Ders / Section", "Tür / Öğretim Elemanı"])
        self.tree_basket.itemChanged.connect(self.on_tree_item_changed)
        self.tree_basket.setContextMenuPolicy(CUSTOM_CONTEXT_MENU)
        self.tree_basket.customContextMenuRequested.connect(self.show_basket_context_menu)
        basket_layout.addWidget(self.tree_basket)

        basket_actions = QHBoxLayout()
        self.btn_remove = QPushButton("Çıkar")
        self.btn_remove.setObjectName("dangerButton")
        self.btn_remove.clicked.connect(self.remove_selected_course_from_basket)
        basket_actions.addWidget(self.btn_remove)

        self.btn_basket_toggle = QPushButton("Tür Değiştir")
        self.btn_basket_toggle.setToolTip("Sepetteki dersin Zorunlu ⇋ Seçmeli durumunu değiştirir")
        self.btn_basket_toggle.clicked.connect(self.toggle_selected_course_type)
        basket_actions.addWidget(self.btn_basket_toggle)

        self.btn_edit_credit = QPushButton("Kredi")
        self.btn_edit_credit.setToolTip("Seçili dersin Yerel Kredi ve AKTS değerlerini düzenler")
        self.btn_edit_credit.clicked.connect(self.edit_selected_course_credit)
        basket_actions.addWidget(self.btn_edit_credit)
        basket_layout.addLayout(basket_actions)

        # 4. BASKET SUMMARY CARD (Toplam Ders, Kredi, AKTS, Ders Saati)
        self.summary_frame = QFrame()
        self.summary_frame.setObjectName("summaryCard")
        self.summary_frame.setStyleSheet("""
            QFrame#summaryCard {
                background-color: #181825;
                border: 1px solid #313244;
                border-radius: 8px;
                padding: 6px 10px;
            }
        """)
        summary_layout = QVBoxLayout(self.summary_frame)
        summary_layout.setContentsMargins(8, 8, 8, 8)
        summary_layout.setSpacing(4)

        self.lbl_summary_title = QLabel("SEPET KREDİ & YÜK ÖZETİ")
        self.lbl_summary_title.setStyleSheet("font-weight: bold; color: #89dceb; font-size: 11px;")
        summary_layout.addWidget(self.lbl_summary_title)

        self.lbl_summary_stats = QLabel("0 Ders   |   0 Kredi   |   0 AKTS")
        self.lbl_summary_stats.setStyleSheet("font-weight: bold; color: #cdd6f4; font-size: 13px;")
        summary_layout.addWidget(self.lbl_summary_stats)

        self.lbl_summary_hours = QLabel("Haftalık Ders Yükü: ~0 Saat / Hafta")
        self.lbl_summary_hours.setStyleSheet("color: #a6adc8; font-size: 11px;")
        summary_layout.addWidget(self.lbl_summary_hours)

        basket_layout.addWidget(self.summary_frame)

        layout.addWidget(basket_group)

        self.populate_departments()
        self.on_search_changed()

    def populate_departments(self):
        depts = sorted(list(self.data_manager.departments))
        if not depts:
            depts = ["CENG", "SENG", "ECE", "IE", "ME", "MATH", "MAN", "LAW", "ARCH", "PHYS", "CHEM", "ENG"]

        # 1. Populate Profile Primary & Secondary Major dropdowns
        self.combo_primary.blockSignals(True)
        self.combo_secondary.blockSignals(True)
        self.combo_sec_type.blockSignals(True)

        self.combo_primary.clear()
        self.combo_secondary.clear()

        self.combo_secondary.addItem("YOK")
        for dept in depts:
            self.combo_primary.addItem(dept)
            self.combo_secondary.addItem(dept)

        saved_p = self.data_manager.student_profile.get("primary_dept", "CENG")
        saved_s = self.data_manager.student_profile.get("secondary_dept", "YOK")
        saved_st = self.data_manager.student_profile.get("secondary_type", "YOK")

        idx_p = self.combo_primary.findText(saved_p)
        if idx_p >= 0:
            self.combo_primary.setCurrentIndex(idx_p)
        idx_s = self.combo_secondary.findText(saved_s)
        if idx_s >= 0:
            self.combo_secondary.setCurrentIndex(idx_s)

        idx_st = self.combo_sec_type.findData(saved_st)
        if idx_st >= 0:
            self.combo_sec_type.setCurrentIndex(idx_st)

        self.combo_primary.blockSignals(False)
        self.combo_secondary.blockSignals(False)
        self.combo_sec_type.blockSignals(False)

        self.update_sec_type_ui()

        # 2. Populate Searchable Department Filter
        self.combo_dept.blockSignals(True)
        self.combo_dept.clear()
        self.combo_dept.addItem("TÜMÜ")
        for dept in depts:
            self.combo_dept.addItem(dept)
        self.combo_dept.blockSignals(False)

    def on_sec_type_changed(self):
        self.update_sec_type_ui()
        self.on_profile_changed()

    def update_sec_type_ui(self):
        sec_type = self.combo_sec_type.currentData() or "YOK"
        is_cankaya = StyleManager.get_active_theme() == "cankaya"
        if sec_type == "YOK":
            self.combo_secondary.setEnabled(False)
            self.lbl_sec_dept.setText("İkinci Bölüm:")
            self.lbl_sec_dept.setStyleSheet("color: #64748b;" if is_cankaya else "color: #6c7086;")
        elif sec_type == "CAP":
            self.combo_secondary.setEnabled(True)
            self.lbl_sec_dept.setText("ÇAP Bölümü:")
            self.lbl_sec_dept.setStyleSheet("color: #7c3aed; font-weight: bold;" if is_cankaya else "color: #f5c2e7; font-weight: bold;")
        elif sec_type == "YANDAL":
            self.combo_secondary.setEnabled(True)
            self.lbl_sec_dept.setText("Yandal Bölümü:")
            self.lbl_sec_dept.setStyleSheet("color: #0284c7; font-weight: bold;" if is_cankaya else "color: #89dceb; font-weight: bold;")

    def refresh_theme(self):
        is_cankaya = StyleManager.get_active_theme() == "cankaya"
        if is_cankaya:
            if hasattr(self, 'lbl_p'):
                self.lbl_p.setStyleSheet("font-weight: bold; color: #002855;")
            if hasattr(self, 'lbl_st'):
                self.lbl_st.setStyleSheet("font-weight: bold; color: #002855;")
        else:
            if hasattr(self, 'lbl_p'):
                self.lbl_p.setStyleSheet("font-weight: bold; color: #89b4fa;")
            if hasattr(self, 'lbl_st'):
                self.lbl_st.setStyleSheet("font-weight: bold; color: #cba6f7;")
        self.update_sec_type_ui()
        self.on_search_changed()
        self.update_basket_tree()

    def on_profile_changed(self):
        p_dept = self.combo_primary.currentText()
        s_dept = self.combo_secondary.currentText()
        sec_type = self.combo_sec_type.currentData() or "YOK"
        self.data_manager.save_student_profile(p_dept, s_dept, sec_type)
        self.on_search_changed()
        self.update_basket_tree()

    def on_search_changed(self):
        query = self.txt_search.text().strip()
        dept = self.combo_dept.currentText().strip()
        type_filter = self.combo_type.currentData()

        p_dept = self.combo_primary.currentText()
        s_dept = self.combo_secondary.currentText()
        sec_type = self.combo_sec_type.currentData() or "YOK"

        results = self.data_manager.search_courses(
            query=query,
            dept_filter=dept,
            type_filter=type_filter,
            primary_dept=p_dept,
            secondary_dept=s_dept,
            secondary_type=sec_type
        )

        self.list_results.clear()
        is_cankaya = StyleManager.get_active_theme() == "cankaya"

        only_eligible = hasattr(self, 'chk_only_eligible') and self.chk_only_eligible.isChecked()
        hide_passed = hasattr(self, 'chk_hide_passed') and self.chk_hide_passed.isChecked()

        for course, c_type, type_label in results:
            prereq_info = self.data_manager.check_course_prerequisites(course.code)
            already_passed = prereq_info.get("already_passed", False)
            can_take = prereq_info.get("can_take", True)
            has_prereqs = prereq_info.get("has_prereqs", False)

            if hide_passed and already_passed:
                continue
            if only_eligible and not can_take:
                continue

            sec_count = len(course.sections)
            cr, ec = self.data_manager.get_course_credits(course.code)

            if already_passed:
                status_tag = "Verildi"
            elif not can_take:
                status_tag = "🔴 Ön Koşul Eksik"
            elif has_prereqs:
                status_tag = "🟢 Alınabilir"
            else:
                status_tag = ""

            status_str = f"  {status_tag}" if status_tag else ""
            display_text = f"[{course.code}]{status_str}  {type_label}  |  {cr} Kr / {ec} AKTS  ({sec_count} Sec)"
            item = QListWidgetItem(display_text)
            item.setData(USER_ROLE, course.code)

            # Prerequisite Tooltip
            tooltip_lines = [f"{course.code} ({sec_count} Şube)"]
            if already_passed:
                tooltip_lines.append("Bu dersi daha önce başarıyla verdiniz.")
            elif not can_take:
                tooltip_lines.append(f"Ön Koşul Eksik: {prereq_info['rule_description']}")
                tooltip_lines.append(f"{prereq_info['message']}")
            elif has_prereqs:
                tooltip_lines.append(f"🟢 Ön Koşul Sağlandı: {prereq_info['rule_description']}")
            else:
                tooltip_lines.append("Ön koşulsuz ders.")
            item.setToolTip("\n".join(tooltip_lines))

            # Visual color hinting
            if not can_take and not already_passed:
                item.setForeground(QColor("#ef4444" if is_cankaya else "#f38ba8"))
            elif already_passed:
                item.setForeground(QColor("#15803d" if is_cankaya else "#a6e3a1"))
            elif is_cankaya:
                if c_type == "ZORUNLU":
                    item.setForeground(QColor("#002855"))
                elif c_type == "ZORUNLU_CAP":
                    item.setForeground(QColor("#7c3aed"))
                elif c_type == "ZORUNLU_YANDAL":
                    item.setForeground(QColor("#0284c7"))
                elif c_type == "TEKNIK_SECMELI":
                    item.setForeground(QColor("#0f766e"))
            else:
                if c_type == "ZORUNLU":
                    item.setForeground(Qt.GlobalColor.white if hasattr(Qt, 'GlobalColor') else Qt.white)
                elif c_type == "ZORUNLU_CAP":
                    item.setForeground(QColor("#f5c2e7"))
                elif c_type == "ZORUNLU_YANDAL":
                    item.setForeground(QColor("#89dceb"))

            self.list_results.addItem(item)
            if self.list_results.count() >= 90:
                break

    def add_selected_course_to_basket(self, item=None):
        if item is None:
            item = self.list_results.currentItem()
        if not item:
            return

        c_code = item.data(USER_ROLE)
        if not c_code or c_code not in self.data_manager.courses:
            return

        if c_code in self.basket_courses:
            return

        # Prerequisite warning check
        prereq_info = self.data_manager.check_course_prerequisites(c_code)
        if not prereq_info.get("can_take", True):
            res = QMessageBox.warning(
                self,
                "Ön Koşul Uyarısı",
                f"<b>{c_code}</b> dersinin ön koşulları transkriptinizde eksik görünüyor!\n\n"
                f"• Gereken Ön Koşul: <b>{prereq_info['rule_description']}</b>\n"
                f"• Durum: {prereq_info['message']}\n\n"
                f"Yine de bu dersi sepetinize eklemek istiyor musunuz?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No
            )
            if self.window():
                self.window().activateWindow()
                self.window().raise_()
            if res != QMessageBox.StandardButton.Yes:
                return

        course = self.data_manager.courses[c_code]
        all_sec_nos = set(course.sections.keys())
        self.basket_courses[c_code] = {
            "course": course,
            "sections": set(all_sec_nos)
        }

        self.update_basket_tree()
        self.courses_changed.emit()

    def remove_selected_course_from_basket(self):
        current_item = self.tree_basket.currentItem()
        if not current_item:
            return

        c_code = current_item.data(0, USER_ROLE)
        if c_code:
            c_code = c_code.split(":")[0]
            if c_code in self.basket_courses:
                del self.basket_courses[c_code]
                self.update_basket_tree()
                self.courses_changed.emit()

    def update_basket_summary(self):
        total_courses = len(self.basket_courses)
        total_credit = 0
        total_ects = 0
        total_hours = 0

        for c_code, data in self.basket_courses.items():
            course = data["course"]
            selected_secs = data["sections"]
            cr, ec = self.data_manager.get_course_credits(course.code)
            total_credit += cr
            total_ects += ec
            if selected_secs:
                hrs = [len(course.sections[s].slots) for s in selected_secs if s in course.sections]
                if hrs:
                    total_hours += int(sum(hrs) / len(hrs))

        if hasattr(self, 'lbl_summary_stats'):
            self.lbl_summary_stats.setText(f"{total_courses} Ders   |   {total_credit} Kredi   |   {total_ects} AKTS")
            self.lbl_summary_hours.setText(f"Haftalık Ders Yükü: ~{total_hours} Saat / Hafta")

    def update_basket_tree(self):
        self.tree_basket.blockSignals(True)
        self.tree_basket.clear()

        p_dept = self.combo_primary.currentText()
        s_dept = self.combo_secondary.currentText()
        sec_type = self.combo_sec_type.currentData() or "YOK"

        for c_code, data in self.basket_courses.items():
            course = data["course"]
            selected_secs = data["sections"]

            _, type_label = self.data_manager.classify_course(course.code, p_dept, s_dept, sec_type)
            cr, ec = self.data_manager.get_course_credits(course.code)

            root = QTreeWidgetItem([f"{course.code}  ({cr} Kr / {ec} AKTS)", type_label])
            root.setData(0, USER_ROLE, c_code)
            all_count = len(course.sections)
            sel_count = len(selected_secs)
            if sel_count == all_count:
                root_state = CHECKED
            elif sel_count == 0:
                root_state = UNCHECKED
            else:
                root_state = PARTIALLY_CHECKED
            root.setCheckState(0, root_state)

            for sec_no, sec in sorted(course.sections.items(), key=lambda x: int(x[0]) if x[0].isdigit() else x[0]):
                sec_room = getattr(sec, 'classroom', '')
                inst_text = sec.instructor or "Belirsiz"
                if sec_room:
                    inst_text += f" | {sec_room}"
                child = QTreeWidgetItem([f"Section {sec_no}", inst_text])
                child.setData(0, USER_ROLE, f"{c_code}:{sec_no}")
                is_checked = sec_no in selected_secs
                child.setCheckState(0, CHECKED if is_checked else UNCHECKED)
                root.addChild(child)

            self.tree_basket.addTopLevelItem(root)
            root.setExpanded(True)

        self.tree_basket.blockSignals(False)
        self.update_basket_summary()

    def on_tree_item_changed(self, item, column):
        data = item.data(0, USER_ROLE)
        if not data:
            return

        self.tree_basket.blockSignals(True)
        try:
            if ":" in data:
                c_code, sec_no = data.split(":")
                if c_code in self.basket_courses:
                    if item.checkState(0) == CHECKED:
                        self.basket_courses[c_code]["sections"].add(sec_no)
                    else:
                        self.basket_courses[c_code]["sections"].discard(sec_no)

                    parent = item.parent()
                    if parent:
                        course = self.basket_courses[c_code]["course"]
                        sel_count = len(self.basket_courses[c_code]["sections"])
                        all_count = len(course.sections)
                        if sel_count == all_count:
                            parent.setCheckState(0, CHECKED)
                        elif sel_count == 0:
                            parent.setCheckState(0, UNCHECKED)
                        else:
                            parent.setCheckState(0, PARTIALLY_CHECKED)
            else:
                c_code = data
                if c_code in self.basket_courses:
                    course = self.basket_courses[c_code]["course"]
                    if item.checkState(0) == CHECKED:
                        self.basket_courses[c_code]["sections"] = set(course.sections.keys())
                        for i in range(item.childCount()):
                            item.child(i).setCheckState(0, CHECKED)
                    elif item.checkState(0) == UNCHECKED:
                        self.basket_courses[c_code]["sections"].clear()
                        for i in range(item.childCount()):
                            item.child(i).setCheckState(0, UNCHECKED)
        finally:
            self.tree_basket.blockSignals(False)

        self.update_basket_summary()
        self.courses_changed.emit()

    def get_selected_target_dict(self):
        target_dict = {}
        for c_code, data in self.basket_courses.items():
            course = data["course"]
            sec_nos = data["sections"]
            selected_secs = [sec for sec_no, sec in course.sections.items() if sec_no in sec_nos]
            if selected_secs:
                target_dict[c_code] = selected_secs
        return target_dict

    def toggle_selected_course_type(self, target_code=None):
        """Toggles a course between Zorunlu and Seçmeli for the current student profile."""
        c_code = target_code
        if not c_code:
            # Check search results selection first
            item = self.list_results.currentItem()
            if item:
                c_code = item.data(USER_ROLE)

        # If still not found, check basket tree selection
        if not c_code:
            tree_item = self.tree_basket.currentItem()
            if tree_item:
                data = tree_item.data(0, USER_ROLE)
                if data:
                    c_code = data.split(":")[0]

        if not c_code or c_code not in self.data_manager.courses:
            QMessageBox.information(
                self,
                "Ders Seçilmedi",
                "Lütfen zorunlu veya seçmeli durumunu değiştirmek istediğiniz bir dersi seçin."
            )
            return

        self.data_manager.toggle_custom_course_type(c_code)
        self.on_search_changed()
        self.update_basket_tree()
        self.courses_changed.emit()

    def edit_selected_course_credit(self, target_code=None):
        """Opens a dialog to customize credit and ECTS for a selected course."""
        c_code = target_code
        if not c_code:
            tree_item = self.tree_basket.currentItem()
            if tree_item:
                data = tree_item.data(0, USER_ROLE)
                if data:
                    c_code = data.split(":")[0]

        if not c_code:
            item = self.list_results.currentItem()
            if item:
                c_code = item.data(USER_ROLE)

        if not c_code or c_code not in self.data_manager.courses:
            QMessageBox.information(
                self,
                "Ders Seçilmedi",
                "Lütfen kredisini düzenlemek istediğiniz bir dersi seçin."
            )
            return

        cur_cr, cur_ec = self.data_manager.get_course_credits(c_code)
        dlg = CreditEditDialog(c_code, cur_cr, cur_ec, parent=self)
        try:
            if dlg.exec():
                self.data_manager.set_custom_course_credits(c_code, dlg.result_credit, dlg.result_ects)
                self.on_search_changed()
                self.update_basket_tree()
                self.courses_changed.emit()
        finally:
            if self.window():
                self.window().activateWindow()
                self.window().raise_()

    def open_selected_course_info(self, item=None):
        c_code = None
        if item is None:
            item = self.list_results.currentItem()
        if item:
            c_code = item.data(USER_ROLE)
        if not c_code:
            b_item = self.tree_basket.currentItem()
            if b_item:
                data = b_item.data(0, USER_ROLE)
                if data:
                    c_code = data.split(":")[0]

        if not c_code:
            QMessageBox.information(
                self,
                "Ders Seçilmedi",
                "Lütfen bilgisini görüntülemek istediğiniz bir dersi seçin."
            )
            if self.window():
                self.window().activateWindow()
                self.window().raise_()
            return

        from gui.conflict_dialog import ConflictDetailDialog
        try:
            ConflictDetailDialog.show_for_course(c_code, self.data_manager, parent=self)
        finally:
            if self.window():
                self.window().activateWindow()
                self.window().raise_()

    def show_results_context_menu(self, pos):
        item = self.list_results.itemAt(pos)
        if not item:
            return

        c_code = item.data(USER_ROLE)
        if not c_code:
            return

        menu = QMenu(self)
        action_info = menu.addAction(f"'{c_code}' Ders Bilgisi ve Web Sayfası")
        action_add = menu.addAction(f"'{c_code}' Sepete Ekle")
        action_toggle = menu.addAction(f"'{c_code}' Zorunlu/Seçmeli Durumunu Değiştir")
        action_credit = menu.addAction(f"'{c_code}' Kredi / AKTS Düzenle")

        selected_action = menu.exec(self.list_results.mapToGlobal(pos))
        if selected_action == action_info:
            from gui.conflict_dialog import ConflictDetailDialog
            ConflictDetailDialog.show_for_course(c_code, self.data_manager, parent=self)
        elif selected_action == action_add:
            self.add_selected_course_to_basket()
        elif selected_action == action_toggle:
            self.toggle_selected_course_type(c_code)
        elif selected_action == action_credit:
            self.edit_selected_course_credit(c_code)

    def show_basket_context_menu(self, pos):
        item = self.tree_basket.itemAt(pos)
        if not item:
            return

        data = item.data(0, USER_ROLE)
        if not data:
            return

        c_code = data.split(":")[0]
        menu = QMenu(self)
        action_info = menu.addAction(f"'{c_code}' Ders Bilgisi ve Web Sayfası")
        action_toggle = menu.addAction(f"'{c_code}' Zorunlu/Seçmeli Durumunu Değiştir")
        action_credit = menu.addAction(f"'{c_code}' Kredi / AKTS Düzenle")
        action_remove = menu.addAction(f"'{c_code}' Sepetten Çıkar")

        selected_action = menu.exec(self.tree_basket.mapToGlobal(pos))
        if selected_action == action_info:
            from gui.conflict_dialog import ConflictDetailDialog
            ConflictDetailDialog.show_for_course(c_code, self.data_manager, parent=self)
        elif selected_action == action_toggle:
            self.toggle_selected_course_type(c_code)
        elif selected_action == action_credit:
            self.edit_selected_course_credit(c_code)
        elif selected_action == action_remove:
            if c_code in self.basket_courses:
                del self.basket_courses[c_code]
                self.update_basket_tree()
                self.courses_changed.emit()

