from gui.qt_compat import (
    QWidget, QHBoxLayout, QLabel, QPushButton, QCheckBox, QFrame,
    Qt, pyqtSignal, ALIGN_CENTER, SHAPE_VLINE
)
from gui.styles import ModernStyle

class CombinationBar(QFrame):
    index_changed = pyqtSignal(int)
    preferences_changed = pyqtSignal(dict)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("panelFrame")
        self.total_combinations = 0
        self.current_index = 0
        self.init_ui()

    def init_ui(self):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(8, 5, 8, 5)
        layout.setSpacing(8)

        # 1. NAVIGATION BUTTONS
        self.btn_prev = QPushButton("◀ Önceki")
        self.btn_prev.clicked.connect(self.prev_combination)
        layout.addWidget(self.btn_prev)

        self.lbl_status = QLabel("Kombinasyon: 0 / 0")
        self.lbl_status.setStyleSheet(f"font-weight: bold; color: {ModernStyle.ACCENT_CYAN}; font-size: 13px;")
        self.lbl_status.setAlignment(ALIGN_CENTER)
        layout.addWidget(self.lbl_status)

        self.btn_next = QPushButton("Sonraki ▶")
        self.btn_next.clicked.connect(self.next_combination)
        layout.addWidget(self.btn_next)

        # Separator Line
        sep = QFrame()
        sep.setFrameShape(SHAPE_VLINE)
        sep.setStyleSheet(f"background-color: {ModernStyle.BORDER_COLOR};")
        layout.addWidget(sep)

        # 2. PREFERENCES / FILTERS
        lbl_pref = QLabel("Filtreler:")
        lbl_pref.setStyleSheet("font-weight: bold; color: #a6adc8; font-size: 11px;")
        layout.addWidget(lbl_pref)

        self.chk_no_morning = QCheckBox("Sabah Yok")
        self.chk_no_morning.setToolTip("Sabah 09:00 derslerini hariç tut")
        self.chk_no_morning.stateChanged.connect(self.on_pref_changed)
        layout.addWidget(self.chk_no_morning)

        self.chk_free_friday = QCheckBox("Cuma Boş")
        self.chk_free_friday.setToolTip("Cuma gününü tamamen boş bırak")
        self.chk_free_friday.stateChanged.connect(self.on_pref_changed)
        layout.addWidget(self.chk_free_friday)

        self.chk_free_monday = QCheckBox("Pzt Boş")
        self.chk_free_monday.setToolTip("Pazartesi gününü tamamen boş bırak")
        self.chk_free_monday.stateChanged.connect(self.on_pref_changed)
        layout.addWidget(self.chk_free_monday)

        # Separator Line 2
        sep2 = QFrame()
        sep2.setFrameShape(SHAPE_VLINE)
        sep2.setStyleSheet(f"background-color: {ModernStyle.BORDER_COLOR};")
        layout.addWidget(sep2)

        # 3. COMBINATION CREDIT SUMMARY
        self.lbl_credit_summary = QLabel("")
        self.lbl_credit_summary.setStyleSheet("font-weight: bold; color: #a6e3a1; font-size: 12px;")
        layout.addWidget(self.lbl_credit_summary)

        layout.addStretch()

        self.update_controls()

    def set_combination_credits(self, course_count=0, credit=0, ects=0):
        if course_count > 0:
            self.lbl_credit_summary.setText(f"{course_count} Ders | {credit} Kr | {ects} AKTS")
        else:
            self.lbl_credit_summary.setText("")

    def set_combinations_count(self, count):
        self.total_combinations = count
        self.current_index = 0 if count > 0 else -1
        self.update_controls()

    def update_controls(self):
        if self.total_combinations > 0:
            self.lbl_status.setText(f"Kombinasyon: {self.current_index + 1} / {self.total_combinations}")
            self.btn_prev.setEnabled(self.current_index > 0)
            self.btn_next.setEnabled(self.current_index < self.total_combinations - 1)
        else:
            self.lbl_status.setText("Uygun Kombinasyon Yok")
            self.btn_prev.setEnabled(False)
            self.btn_next.setEnabled(False)

    def prev_combination(self):
        if self.current_index > 0:
            self.current_index -= 1
            self.update_controls()
            self.index_changed.emit(self.current_index)

    def next_combination(self):
        if self.current_index < self.total_combinations - 1:
            self.current_index += 1
            self.update_controls()
            self.index_changed.emit(self.current_index)

    def on_pref_changed(self):
        prefs = {
            "no_morning": self.chk_no_morning.isChecked(),
            "free_friday": self.chk_free_friday.isChecked(),
            "free_monday": self.chk_free_monday.isChecked(),
        }
        self.preferences_changed.emit(prefs)
