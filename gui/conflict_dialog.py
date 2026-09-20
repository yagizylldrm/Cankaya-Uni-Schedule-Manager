import webbrowser
from gui.qt_compat import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QScrollArea,
    QWidget, QFrame, Qt, ALIGN_CENTER, ALIGN_LEFT, POINTING_HAND_CURSOR
)
from gui.styles import StyleManager, ModernStyle, CankayaStyle

class ConflictDetailDialog(QDialog):
    """
    Dialog displaying detailed information about courses
    (course info, syllabus description, official course web page links,
    section schedules, instructors, classrooms, and conflicts).
    """
    def __init__(self, day_name, time_slot, entries, custom_block=None, data_manager=None, parent=None):
        super().__init__(parent)
        self.day_name = day_name
        self.time_slot = time_slot
        self.entries = entries  # List of (Section, ScheduleSlot)
        self.custom_block = custom_block  # User's custom block dict if any
        self.custom_block_modified = False
        self.data_manager = data_manager
        self.init_ui()

    @classmethod
    def show_for_course(cls, course_code, data_manager, parent=None):
        """Helper to open this detail dialog for a single course from anywhere in the app."""
        if not data_manager:
            return
        norm = data_manager.normalize_code(course_code)
        if norm not in data_manager.courses:
            return
        course = data_manager.courses[norm]
        entries = []
        for sec in course.sections.values():
            if sec.slots:
                for slot in sec.slots:
                    entries.append((sec, slot))
            else:
                entries.append((sec, None))
        dlg = cls("Ders Kataloğu", norm, entries, custom_block=None, data_manager=data_manager, parent=parent)
        if hasattr(dlg, 'exec'):
            dlg.exec()
        else:
            dlg.exec_()

    def edit_custom_block(self):
        from gui.custom_block_dialog import CustomBlockEditDialog
        dlg = CustomBlockEditDialog(self.day_name, self.time_slot, current_block=self.custom_block, parent=self)
        if dlg.exec():
            if getattr(dlg, 'deleted', False) and self.data_manager:
                self.data_manager.delete_custom_schedule_block(self.day_name, self.time_slot)
                self.custom_block_modified = True
                self.accept()
            elif dlg.result_data and self.data_manager:
                if dlg.result_data.get("all_weekdays"):
                    for d in ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"]:
                        self.data_manager.set_custom_schedule_block(
                            d, self.time_slot, dlg.result_data["title"], dlg.result_data.get("note", ""), dlg.result_data.get("color", "amber")
                        )
                else:
                    self.data_manager.set_custom_schedule_block(
                        self.day_name, self.time_slot, dlg.result_data["title"], dlg.result_data.get("note", ""), dlg.result_data.get("color", "amber")
                    )
                self.custom_block_modified = True
                self.accept()

    def init_ui(self):
        distinct_codes = sorted(list(set(sec.course_code for sec, _ in self.entries)))
        is_conflict = len(distinct_codes) > 1 or (self.custom_block is not None and len(self.entries) > 0)
        is_dark = StyleManager.get_active_theme() == "modern"

        if self.custom_block is not None and len(self.entries) > 0:
            self.setWindowTitle(f"Ders & Etkinlik Çakışması - {self.day_name} {self.time_slot}")
        elif is_conflict:
            self.setWindowTitle(f"Ders Çakışma Detayları - {self.day_name} {self.time_slot}")
        else:
            course_title = distinct_codes[0] if distinct_codes else ""
            self.setWindowTitle(f"{course_title} Ders Bilgisi & Sayfası - {self.day_name}")

        self.setMinimumWidth(580)
        self.setMaximumWidth(720)
        self.setMinimumHeight(480)
        self.resize(640, 560)

        # Dialog theme styling
        dialog_bg = "#1e1e2e" if is_dark else "#f8fafc"
        dialog_text = "#cdd6f4" if is_dark else "#0f172a"
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {dialog_bg};
                color: {dialog_text};
            }}
        """)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(18, 18, 18, 18)
        main_layout.setSpacing(12)

        # Header Banner
        header_frame = QFrame()
        if is_conflict:
            conf_bg, conf_border, conf_text = StyleManager.get_conflict_style()
            header_frame.setStyleSheet(f"""
                QFrame {{
                    background-color: {conf_bg};
                    border: 2px solid {conf_border};
                    border-radius: 8px;
                    padding: 8px;
                }}
            """)
        else:
            h_bg = "#24273a" if is_dark else "#e0f2fe"
            h_border = "#89b4fa" if is_dark else "#0284c7"
            header_frame.setStyleSheet(f"""
                QFrame {{
                    background-color: {h_bg};
                    border: 2px solid {h_border};
                    border-radius: 8px;
                    padding: 8px;
                }}
            """)

        h_layout = QVBoxLayout(header_frame)
        h_layout.setContentsMargins(10, 8, 10, 8)
        h_layout.setSpacing(3)

        if self.custom_block is not None and len(self.entries) > 0:
            lbl_title = QLabel("<b>DERS VE KİŞİSEL ETKİNLİK ÇAKIŞMASI TESPİT EDİLDİ</b>")
            lbl_title.setStyleSheet(f"color: {conf_text}; font-size: 14px;")
            lbl_desc = QLabel(
                f"<b>{self.day_name}</b> günü <b>{self.time_slot}</b> saatinde "
                f"eklediğiniz <b>{self.custom_block['title']}</b> etkinliği ile ders aynı saate denk gelmektedir."
            )
            lbl_desc.setStyleSheet(f"color: {'#cdd6f4' if is_dark else '#334155'}; font-size: 12px;")
        elif is_conflict:
            lbl_title = QLabel("<b>DERS ÇAKIŞMASI TESPİT EDİLDİ</b>")
            lbl_title.setStyleSheet(f"color: {conf_text}; font-size: 14px;")
            lbl_desc = QLabel(
                f"<b>{self.day_name}</b> günü <b>{self.time_slot}</b> saatinde "
                f"<b>{len(distinct_codes)} farklı ders</b> aynı anda açılmaktadır:"
            )
            lbl_desc.setStyleSheet(f"color: {'#cdd6f4' if is_dark else '#334155'}; font-size: 12px;")
        else:
            h_title_color = "#89b4fa" if is_dark else "#0369a1"
            lbl_title = QLabel("<b>DERS BİLGİSİ VE SAYFASI</b>")
            lbl_title.setStyleSheet(f"color: {h_title_color}; font-size: 14px;")
            lbl_desc = QLabel(f"<b>{self.day_name}</b> {self.time_slot} - Ayrıntılı ders tanımı ve şube bilgileri:")
            lbl_desc.setStyleSheet(f"color: {'#cdd6f4' if is_dark else '#334155'}; font-size: 12px;")

        lbl_desc.setWordWrap(True)
        h_layout.addWidget(lbl_title)
        h_layout.addWidget(lbl_desc)
        main_layout.addWidget(header_frame)

        # Scrollable area for cards
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll_bg = "#181825" if is_dark else "#f1f5f9"
        scroll_border = "#313244" if is_dark else "#cbd5e1"
        scroll.setStyleSheet(f"""
            QScrollArea {{
                border: 1px solid {scroll_border};
                background-color: {scroll_bg};
                border-radius: 8px;
            }}
        """)

        cards_container = QWidget()
        cards_layout = QVBoxLayout(cards_container)
        cards_layout.setContentsMargins(10, 10, 10, 10)
        cards_layout.setSpacing(12)

        # 1. If custom block is present, render it first
        if self.custom_block:
            block_card = QFrame()
            cb_color = self.custom_block.get("color", "amber")
            bg_hex, border_hex, text_hex = StyleManager.get_custom_block_style(cb_color)
            block_card.setStyleSheet(f"""
                QFrame {{
                    background-color: {bg_hex};
                    border: 2px solid {border_hex};
                    border-radius: 8px;
                    padding: 8px;
                }}
            """)
            b_layout = QVBoxLayout(block_card)
            b_layout.setSpacing(6)

            b_top = QHBoxLayout()
            lbl_b_title = QLabel(f"<b>Kişisel Etkinliğiniz: {self.custom_block['title']}</b>")
            lbl_b_title.setStyleSheet(f"color: {text_hex}; font-size: 13px; font-weight: bold; border: none; background: transparent;")
            b_top.addWidget(lbl_b_title, 1)

            btn_edit_block = QPushButton("Etkinliği Düzenle / Sil")
            btn_edit_block.setCursor(POINTING_HAND_CURSOR)
            btn_edit_block.setStyleSheet(f"""
                QPushButton {{
                    background-color: {'#313244' if is_dark else '#ffffff'};
                    color: {'#cdd6f4' if is_dark else '#0f172a'};
                    border: 1px solid {border_hex};
                    border-radius: 4px;
                    padding: 4px 10px;
                    font-size: 11px;
                    font-weight: bold;
                }}
                QPushButton:hover {{
                    background-color: {border_hex};
                    color: #ffffff;
                }}
            """)
            btn_edit_block.clicked.connect(self.edit_custom_block)
            b_top.addWidget(btn_edit_block)
            b_layout.addLayout(b_top)

            if self.custom_block.get("note"):
                lbl_b_note = QLabel(f"<b>Not:</b> {self.custom_block['note']}")
                lbl_b_note.setStyleSheet(f"color: {text_hex}; font-size: 11px; border: none; background: transparent;")
                b_layout.addWidget(lbl_b_note)

            lbl_b_time = QLabel(f"<b>Zaman:</b> {self.day_name} {self.time_slot}")
            lbl_b_time.setStyleSheet(f"color: {text_hex}; font-size: 11px; border: none; background: transparent;")
            b_layout.addWidget(lbl_b_time)

            cards_layout.addWidget(block_card)

        # 2. Group entries by course
        courses_map = {}
        for sec, slot in self.entries:
            courses_map.setdefault(sec.course_code, []).append((sec, slot))

        for c_idx, (c_code, sec_slots) in enumerate(courses_map.items()):
            course_card = QFrame()
            card_bg = "#1e1e2e" if is_dark else "#ffffff"
            card_border = ("#f38ba8" if is_conflict else "#89b4fa") if is_dark else ("#ef4444" if is_conflict else "#002855")
            course_card.setStyleSheet(f"""
                QFrame {{
                    background-color: {card_bg};
                    border: 1px solid {card_border};
                    border-left: 5px solid {card_border};
                    border-radius: 6px;
                    padding: 6px;
                }}
            """)
            card_layout = QVBoxLayout(course_card)
            card_layout.setSpacing(8)

            # Retrieve rich course info
            info = self.data_manager.get_course_info(c_code) if self.data_manager else {
                "code": c_code,
                "name": c_code,
                "dept_code": "",
                "dept_name": "",
                "level": 1,
                "credit": 3,
                "ects": 5,
                "description": "Çankaya Üniversitesi dersi.",
                "course_url": f"http://{c_code.lower()}.cankaya.edu.tr/",
                "dept_url": "https://www.cankaya.edu.tr/",
                "ebs_url": "https://ebs.cankaya.edu.tr/",
                "search_url": f"https://www.google.com/search?q=cankaya+universitesi+{c_code}+ders+tanimi"
            }

            # 1. Course Title & Badges
            c_header = QHBoxLayout()
            c_title_color = "#89b4fa" if is_dark else "#002855"
            lbl_course = QLabel(f"<b>{c_code}</b>: <span style='font-weight: normal;'>{info['name']}</span>")
            lbl_course.setStyleSheet(f"font-size: 13px; color: {c_title_color};")
            lbl_course.setWordWrap(True)
            c_header.addWidget(lbl_course, 1)

            if self.data_manager:
                c_type, type_label = self.data_manager.classify_course(c_code)
                badge_bg = "#313244" if is_dark else "#e2e8f0"
                badge_fg = "#b4befe" if is_dark else "#1e3a8a"
                lbl_badge = QLabel(type_label)
                lbl_badge.setStyleSheet(f"""
                    background-color: {badge_bg};
                    color: {badge_fg};
                    border-radius: 4px;
                    padding: 2px 8px;
                    font-size: 11px;
                    font-weight: bold;
                """)
                c_header.addWidget(lbl_badge)

                cr_bg = "#1e2030" if is_dark else "#dcfce7"
                cr_fg = "#a6e3a1" if is_dark else "#166534"
                cr_border = "#45475a" if is_dark else "#86efac"
                lbl_cr_badge = QLabel(f"{info['credit']} Kredi | {info['ects']} AKTS")
                lbl_cr_badge.setStyleSheet(f"""
                    background-color: {cr_bg};
                    color: {cr_fg};
                    border: 1px solid {cr_border};
                    border-radius: 4px;
                    padding: 2px 8px;
                    font-size: 11px;
                    font-weight: bold;
                """)
                c_header.addWidget(lbl_cr_badge)

            card_layout.addLayout(c_header)

            # 2. Course Information Box (Ders Hakkında Bilgi)
            info_box = QFrame()
            info_box_bg = "#24273a" if is_dark else "#f8fafc"
            info_box_border = "#45475a" if is_dark else "#e2e8f0"
            info_box.setStyleSheet(f"""
                QFrame {{
                    background-color: {info_box_bg};
                    border: 1px solid {info_box_border};
                    border-radius: 6px;
                    padding: 8px;
                }}
            """)
            info_layout = QVBoxLayout(info_box)
            info_layout.setSpacing(4)

            meta_text_color = "#9399b2" if is_dark else "#64748b"
            lbl_meta = QLabel(f"<b>Bölüm & Düzey:</b> <span style='color: {'#cdd6f4' if is_dark else '#0f172a'};'>{info['dept_name']} • {info['level']}. Sınıf Lisans Dersi</span>")
            lbl_meta.setStyleSheet(f"color: {meta_text_color}; font-size: 11px;")
            info_layout.addWidget(lbl_meta)

            desc_color = "#bac2de" if is_dark else "#334155"
            lbl_desc = QLabel(f"<b>Ders Tanımı / Kapsamı:</b> {info['description']}")
            lbl_desc.setStyleSheet(f"color: {desc_color}; font-size: 11px; line-height: 1.4;")
            lbl_desc.setWordWrap(True)
            info_layout.addWidget(lbl_desc)

            # Prerequisite Status
            if self.data_manager:
                prereq = self.data_manager.check_course_prerequisites(c_code)
                if prereq.get("already_passed"):
                    prereq_text = "<b>Ön Koşul / Durum:</b> <span style='color: #10b981; font-weight: bold;'>Bu dersi daha önce başarıyla verdiniz.</span>"
                elif prereq.get("can_take"):
                    if prereq.get("has_prereqs"):
                        prereq_text = f"<b>Ön Koşul Durumu:</b> <span style='color: #10b981; font-weight: bold;'>Sağlandı</span> <span style='color: {'#a6adc8' if is_dark else '#475569'};'>({prereq['rule_description']})</span>"
                    else:
                        prereq_text = f"<b>Ön Koşul Durumu:</b> <span style='color: {'#9399b2' if is_dark else '#64748b'};'>Ön koşulsuz ders</span>"
                else:
                    prereq_text = f"<b>Ön Koşul Durumu:</b> <span style='color: #ef4444; font-weight: bold;'>SAĞLANMADI!</span> <span style='color: {'#f38ba8' if is_dark else '#b91c1c'};'>({prereq['message']})</span>"

                lbl_prereq = QLabel(prereq_text)
                lbl_prereq.setStyleSheet("font-size: 11px; margin-top: 2px;")
                lbl_prereq.setWordWrap(True)
                info_layout.addWidget(lbl_prereq)

            card_layout.addWidget(info_box)

            # 3. Course Page Links (Ders Sayfası Linki ve Bağlantılar)
            links_box = QFrame()
            links_bg = "#181825" if is_dark else "#eff6ff"
            links_border = "#313244" if is_dark else "#bfdbfe"
            links_box.setStyleSheet(f"""
                QFrame {{
                    background-color: {links_bg};
                    border: 1px solid {links_border};
                    border-radius: 6px;
                    padding: 8px;
                }}
            """)
            links_layout = QVBoxLayout(links_box)
            links_layout.setSpacing(6)

            lbl_links_title = QLabel("<b>Ders Sayfası ve Bağlantılar:</b>")
            lbl_links_title.setStyleSheet(f"color: {'#89b4fa' if is_dark else '#1d4ed8'}; font-size: 11px;")
            links_layout.addWidget(lbl_links_title)

            # Clickable HTML link
            link_url = info['course_url']
            link_color = "#89b4fa" if is_dark else "#0284c7"
            lbl_link_html = QLabel(
                f"• <b>Ders Web Sayfası:</b> <a href='{link_url}' style='color: {link_color}; text-decoration: underline;'>{link_url}</a>"
            )
            lbl_link_html.setOpenExternalLinks(True)
            lbl_link_html.setStyleSheet(f"font-size: 11px; color: {'#cdd6f4' if is_dark else '#0f172a'};")
            links_layout.addWidget(lbl_link_html)

            # Action buttons row
            btn_row = QHBoxLayout()
            btn_row.setSpacing(8)

            btn_open_page = QPushButton("Ders Sayfasını Aç")
            btn_open_page.setCursor(POINTING_HAND_CURSOR)
            btn_open_page.setToolTip(f"Tarayıcıda aç: {link_url}")
            btn_open_page.setStyleSheet(f"""
                QPushButton {{
                    background-color: {'#3b82f6' if is_dark else '#002855'};
                    color: #ffffff;
                    border: none;
                    border-radius: 4px;
                    padding: 5px 12px;
                    font-size: 11px;
                    font-weight: bold;
                }}
                QPushButton:hover {{
                    background-color: {'#2563eb' if is_dark else '#d49a17'};
                }}
            """)
            btn_open_page.clicked.connect(lambda _, u=link_url: webbrowser.open(u))
            btn_row.addWidget(btn_open_page)

            if info.get('dept_url'):
                btn_open_dept = QPushButton("Bölüm Ders Tanımları")
                btn_open_dept.setCursor(POINTING_HAND_CURSOR)
                btn_open_dept.setToolTip(f"Tarayıcıda aç: {info['dept_url']}")
                btn_open_dept.setStyleSheet(f"""
                    QPushButton {{
                        background-color: {'#313244' if is_dark else '#e2e8f0'};
                        color: {'#cdd6f4' if is_dark else '#1e293b'};
                        border: 1px solid {'#45475a' if is_dark else '#cbd5e1'};
                        border-radius: 4px;
                        padding: 5px 10px;
                        font-size: 11px;
                    }}
                    QPushButton:hover {{
                        background-color: {'#45475a' if is_dark else '#cbd5e1'};
                    }}
                """)
                btn_open_dept.clicked.connect(lambda _, u=info['dept_url']: webbrowser.open(u))
                btn_row.addWidget(btn_open_dept)

            btn_search = QPushButton("Google'da İzlence Ara")
            btn_search.setCursor(POINTING_HAND_CURSOR)
            btn_search.setToolTip(f"Tarayıcıda aç: {info['search_url']}")
            btn_search.setStyleSheet(f"""
                QPushButton {{
                    background-color: {'#313244' if is_dark else '#e2e8f0'};
                    color: {'#cdd6f4' if is_dark else '#1e293b'};
                    border: 1px solid {'#45475a' if is_dark else '#cbd5e1'};
                    border-radius: 4px;
                    padding: 5px 10px;
                    font-size: 11px;
                }}
                QPushButton:hover {{
                    background-color: {'#45475a' if is_dark else '#cbd5e1'};
                }}
            """)
            btn_search.clicked.connect(lambda _, u=info['search_url']: webbrowser.open(u))
            btn_row.addWidget(btn_search)

            btn_row.addStretch()
            links_layout.addLayout(btn_row)
            card_layout.addWidget(links_box)

            # 4. Sections involved
            sec_dict = {}
            for sec, slot in sec_slots:
                sec_dict.setdefault(sec.section_no, sec)

            for sec_no, sec in sec_dict.items():
                sec_box = QFrame()
                sec_box_bg = "#24273a" if is_dark else "#f8fafc"
                sec_box_border = "#45475a" if is_dark else "#e2e8f0"
                sec_box.setStyleSheet(f"""
                    QFrame {{
                        background-color: {sec_box_bg};
                        border: 1px solid {sec_box_border};
                        border-radius: 4px;
                        padding: 6px;
                    }}
                """)
                sec_layout = QVBoxLayout(sec_box)
                sec_layout.setSpacing(3)

                lbl_sec_title = QLabel(f"<b>Section {sec.section_no}</b>")
                lbl_sec_title.setStyleSheet(f"color: {'#89b4fa' if is_dark else '#002855'}; font-size: 12px;")
                sec_layout.addWidget(lbl_sec_title)

                lbl_inst = QLabel(f"<b>Öğretim Elemanı:</b> {sec.instructor or 'Belirsiz'}")
                lbl_inst.setStyleSheet(f"color: {'#a6adc8' if is_dark else '#475569'}; font-size: 11px;")
                sec_layout.addWidget(lbl_inst)

                # Classroom if specified by the school
                sec_room = getattr(sec, 'classroom', '')
                if not sec_room:
                    slot_rooms = [s.classroom for s in sec.slots if getattr(s, 'classroom', None)]
                    if slot_rooms:
                        sec_room = ", ".join(sorted(set(slot_rooms)))

                if sec_room:
                    lbl_room = QLabel(f"<b>Derslik / Sınıf:</b> <span style='color: {'#4ade80' if is_dark else '#15803d'}; font-weight: bold;'>{sec_room}</span>")
                    lbl_room.setStyleSheet("font-size: 11px;")
                    sec_layout.addWidget(lbl_room)
                else:
                    lbl_room = QLabel("<b>Derslik:</b> <span style='color: #64748b;'>Okul sitesinde belirtilmemiş</span>")
                    lbl_room.setStyleSheet("font-size: 11px;")
                    sec_layout.addWidget(lbl_room)

                # All weekly slots for this section
                all_slots_str = ", ".join(f"{s.day} {s.time_slot}" for s in sec.slots)
                lbl_all_slots = QLabel(f"<b>Tüm Saatleri:</b> {all_slots_str}")
                lbl_all_slots.setStyleSheet(f"color: {'#9399b2' if is_dark else '#64748b'}; font-size: 11px;")
                lbl_all_slots.setWordWrap(True)
                sec_layout.addWidget(lbl_all_slots)

                card_layout.addWidget(sec_box)

            # 5. Check alternative sections if data_manager is available
            if self.data_manager and c_code in self.data_manager.courses:
                full_course = self.data_manager.courses[c_code]
                active_sec_nos = set(sec_dict.keys())
                other_secs = [s for s_no, s in full_course.sections.items() if s_no not in active_sec_nos]

                if other_secs:
                    lbl_alt_title = QLabel("<i>Çakışmayı çözmek için alternatif diğer şubeler:</i>")
                    lbl_alt_title.setStyleSheet(f"color: {'#a6e3a1' if is_dark else '#15803d'}; font-size: 11px; margin-top: 4px;")
                    card_layout.addWidget(lbl_alt_title)

                    for alt_sec in sorted(other_secs, key=lambda x: int(x.section_no) if x.section_no.isdigit() else x.section_no):
                        alt_slots_str = ", ".join(f"{s.day} {s.time_slot}" for s in alt_sec.slots)
                        alt_room = getattr(alt_sec, 'classroom', '')
                        room_suffix = f" [{alt_room}]" if alt_room else ""
                        lbl_alt = QLabel(f"  • <b>Sec {alt_sec.section_no}</b> ({alt_sec.instructor}{room_suffix}): {alt_slots_str}")
                        lbl_alt.setStyleSheet(f"color: {'#a6adc8' if is_dark else '#475569'}; font-size: 11px;")
                        lbl_alt.setWordWrap(True)
                        card_layout.addWidget(lbl_alt)

            cards_layout.addWidget(course_card)

        cards_layout.addStretch()
        scroll.setWidget(cards_container)
        main_layout.addWidget(scroll)

        # Bottom buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        btn_close = QPushButton("Kapat")
        btn_close.setObjectName("primaryButton")
        btn_close.setFixedWidth(110)
        btn_close.setStyleSheet(f"""
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
        btn_close.clicked.connect(self.accept)
        btn_layout.addWidget(btn_close)

        main_layout.addLayout(btn_layout)

