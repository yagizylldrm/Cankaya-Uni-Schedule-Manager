from gui.qt_compat import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QComboBox,
    QPushButton, QCheckBox, QFrame, Qt, ALIGN_CENTER, POINTING_HAND_CURSOR
)
from gui.styles import StyleManager

class CustomBlockEditDialog(QDialog):
    """
    Dialog allowing students to add, edit, or delete custom timetable blocks
    (e.g., Lunch break 10-11, Gym, Study session, Work, etc.).
    """
    PRESETS = [
        {"label": "Yemek Arası", "title": "Yemek Arası", "note": "12-13 / Öğle Yemeği", "color": "amber"},
        {"label": "Mola / Kahve", "title": "Mola", "note": "Dinlenme & Kahve", "color": "emerald"},
        {"label": "Ders Çalışma", "title": "Ders Çalışma", "note": "Kütüphane / Tekrar", "color": "blue"},
        {"label": "Spor / Fitness", "title": "Spor", "note": "Antrenman", "color": "purple"},
        {"label": "İş / Staj", "title": "İş / Staj", "note": "Ofis & Çalışma", "color": "rose"},
    ]

    COLORS = [
        ("amber", "🟡 Amber / Turuncu (Yemek)"),
        ("emerald", "🟢 Zümrüt / Yeşil (Mola & Spor)"),
        ("blue", "🔵 Mavi / Lacivert (Ders Çalışma)"),
        ("purple", "🟣 Mor / Eflatun (Kişisel & Etkinlik)"),
        ("rose", "🔴 Kırmızı / Gül (Önemli & İş)"),
        ("slate", "⚪ Gri / Slate (Genel Not)"),
    ]

    def __init__(self, day_name, time_slot, current_block=None, parent=None):
        super().__init__(parent)
        self.day_name = day_name
        self.time_slot = time_slot
        self.current_block = current_block or {}
        self.result_data = None
        self.deleted = False
        self.init_ui()

    def init_ui(self):
        is_dark = StyleManager.get_active_theme() == "modern"
        is_edit = bool(self.current_block)

        self.setWindowTitle("Özel Program Kutusu Düzenle" if is_edit else "Özel Program Kutusu Ekle")
        self.setFixedWidth(440)

        # Dialog theme
        bg_color = "#1e1e2e" if is_dark else "#f8fafc"
        text_color = "#cdd6f4" if is_dark else "#0f172a"
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {bg_color};
                color: {text_color};
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(14)

        # Header Frame
        header_frame = QFrame()
        h_bg = "#24273a" if is_dark else "#e0f2fe"
        h_border = "#89b4fa" if is_dark else "#0284c7"
        header_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {h_bg};
                border: 1px solid {h_border};
                border-radius: 8px;
                padding: 10px;
            }}
        """)
        h_layout = QVBoxLayout(header_frame)
        h_layout.setSpacing(4)

        lbl_title = QLabel(f"<b>{self.day_name}</b> • <b>{self.time_slot}</b>")
        lbl_title.setStyleSheet(f"font-size: 13px; color: {'#89b4fa' if is_dark else '#0369a1'};")
        lbl_sub = QLabel("Bu saat dilimi için özel etkinlik, mola veya not belirleyin:")
        lbl_sub.setStyleSheet(f"font-size: 11px; color: {'#a6adc8' if is_dark else '#475569'};")

        h_layout.addWidget(lbl_title)
        h_layout.addWidget(lbl_sub)
        layout.addWidget(header_frame)

        # Quick Presets
        lbl_presets = QLabel("<b>Hızlı Şablonlar:</b>")
        lbl_presets.setStyleSheet(f"font-size: 11px; color: {'#9399b2' if is_dark else '#64748b'};")
        layout.addWidget(lbl_presets)

        preset_layout = QHBoxLayout()
        preset_layout.setSpacing(6)
        for p in self.PRESETS:
            btn_p = QPushButton(p["label"])
            btn_p.setCursor(POINTING_HAND_CURSOR)
            btn_p.setStyleSheet(f"""
                QPushButton {{
                    background-color: {'#313244' if is_dark else '#e2e8f0'};
                    color: {'#cdd6f4' if is_dark else '#1e293b'};
                    border: 1px solid {'#45475a' if is_dark else '#cbd5e1'};
                    border-radius: 12px;
                    padding: 4px 8px;
                    font-size: 10px;
                }}
                QPushButton:hover {{
                    background-color: {'#45475a' if is_dark else '#cbd5e1'};
                    border-color: {'#89b4fa' if is_dark else '#002855'};
                }}
            """)
            btn_p.clicked.connect(lambda _, preset=p: self.apply_preset(preset))
            preset_layout.addWidget(btn_p)
        layout.addLayout(preset_layout)

        # Input 1: Title
        lbl_in_title = QLabel("Etkinlik Başlığı (Üst Metin):")
        lbl_in_title.setStyleSheet("font-size: 11px; font-weight: bold;")
        self.edit_title = QLineEdit()
        self.edit_title.setPlaceholderText("Örn. Yemek Arası, Çalışma, Mola")
        self.edit_title.setText(self.current_block.get("title", ""))
        layout.addWidget(lbl_in_title)
        layout.addWidget(self.edit_title)

        # Input 2: Note
        lbl_in_note = QLabel("Açıklama / Saat Notu (Alt Metin):")
        lbl_in_note.setStyleSheet("font-size: 11px; font-weight: bold;")
        self.edit_note = QLineEdit()
        self.edit_note.setPlaceholderText("Örn. 10-11, Yemekhane, Kütüphane")
        self.edit_note.setText(self.current_block.get("note", ""))
        layout.addWidget(lbl_in_note)
        layout.addWidget(self.edit_note)

        # Input 3: Color
        lbl_in_color = QLabel("Renk / Kategori:")
        lbl_in_color.setStyleSheet("font-size: 11px; font-weight: bold;")
        self.combo_color = QComboBox()
        cur_color = self.current_block.get("color", "amber")
        select_idx = 0
        for idx, (c_key, c_name) in enumerate(self.COLORS):
            self.combo_color.addItem(c_name, c_key)
            if c_key == cur_color:
                select_idx = idx
        self.combo_color.setCurrentIndex(select_idx)
        layout.addWidget(lbl_in_color)
        layout.addWidget(self.combo_color)

        # Checkbox: Apply to all weekdays
        self.chk_all_weekdays = QCheckBox("Hafta içi tüm günlere uygula (Pazartesi - Cuma)")
        self.chk_all_weekdays.setStyleSheet("font-size: 11px;")
        layout.addWidget(self.chk_all_weekdays)

        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(10)

        if is_edit:
            self.btn_delete = QPushButton("Sil")
            self.btn_delete.setCursor(POINTING_HAND_CURSOR)
            self.btn_delete.setStyleSheet("""
                QPushButton {
                    background-color: #ef4444;
                    color: #ffffff;
                    border: none;
                    border-radius: 4px;
                    padding: 6px 14px;
                    font-size: 11px;
                    font-weight: bold;
                }
                QPushButton:hover {
                    background-color: #dc2626;
                }
            """)
            self.btn_delete.clicked.connect(self.on_delete)
            btn_layout.addWidget(self.btn_delete)

        btn_layout.addStretch()

        btn_cancel = QPushButton("İptal")
        btn_cancel.setCursor(POINTING_HAND_CURSOR)
        btn_cancel.setStyleSheet(f"""
            QPushButton {{
                background-color: {'#313244' if is_dark else '#e2e8f0'};
                color: {'#cdd6f4' if is_dark else '#1e293b'};
                border: 1px solid {'#45475a' if is_dark else '#cbd5e1'};
                border-radius: 4px;
                padding: 6px 14px;
                font-size: 11px;
            }}
            QPushButton:hover {{
                background-color: {'#45475a' if is_dark else '#cbd5e1'};
            }}
        """)
        btn_cancel.clicked.connect(self.reject)
        btn_layout.addWidget(btn_cancel)

        btn_save = QPushButton("Kaydet")
        btn_save.setCursor(POINTING_HAND_CURSOR)
        btn_save.setStyleSheet(f"""
            QPushButton {{
                background-color: {'#3b82f6' if is_dark else '#002855'};
                color: #ffffff;
                border: none;
                border-radius: 4px;
                padding: 6px 18px;
                font-size: 11px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: {'#2563eb' if is_dark else '#d49a17'};
            }}
        """)
        btn_save.clicked.connect(self.on_save)
        btn_layout.addWidget(btn_save)

        layout.addLayout(btn_layout)

    def apply_preset(self, preset):
        self.edit_title.setText(preset["title"])
        # If note in preset contains generic time e.g. "12-13", customize with slot hours if available
        note = preset["note"]
        if "12-13" in note and self.time_slot:
            parts = self.time_slot.split('-')
            if len(parts) == 2:
                start_h = parts[0].strip().split(':')[0]
                end_h = parts[1].strip().split(':')[0]
                note = note.replace("12-13", f"{start_h}-{end_h}")
        self.edit_note.setText(note)

        for idx in range(self.combo_color.count()):
            if self.combo_color.itemData(idx) == preset["color"]:
                self.combo_color.setCurrentIndex(idx)
                break

    def on_save(self):
        title = self.edit_title.text().strip()
        if not title:
            title = "Özel Etkinlik"

        note = self.edit_note.text().strip()
        color = self.combo_color.currentData() or "amber"
        all_weekdays = self.chk_all_weekdays.isChecked()

        self.result_data = {
            "title": title,
            "note": note,
            "color": color,
            "all_weekdays": all_weekdays
        }
        self.accept()

    def on_delete(self):
        self.deleted = True
        self.accept()
