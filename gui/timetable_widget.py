from gui.qt_compat import (
    QTableWidget, QTableWidgetItem, QHeaderView, QWidget, QVBoxLayout, QLabel, QFrame,
    Qt, QColor, QFont, QBrush, ALIGN_CENTER, RESIZE_STRETCH, RESIZE_FIXED, NO_EDIT_TRIGGERS,
    NO_SELECTION, NO_FOCUS, ITEM_ENABLED, POINTING_HAND_CURSOR, pyqtSignal, QTimer
)
from gui.styles import StyleManager, ModernStyle, CankayaStyle
from gui.conflict_dialog import ConflictDetailDialog
from gui.custom_block_dialog import CustomBlockEditDialog

class TimetableWidget(QTableWidget):
    custom_blocks_changed = pyqtSignal()
    DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
    
    TIME_SLOTS = [
        "08:40 - 09:30",
        "09:00 - 09:50",
        "10:00 - 10:50",
        "11:00 - 11:50",
        "12:00 - 12:50",
        "13:00 - 13:50",
        "14:00 - 14:50",
        "15:00 - 15:50",
        "16:00 - 16:50",
        "17:00 - 17:50",
        "18:00 - 18:50",
        "19:00 - 19:50",
        "20:00 - 20:50",
    ]

    def __init__(self, data_manager=None, parent=None):
        super().__init__(len(self.TIME_SLOTS), len(self.DAYS), parent)
        self.data_manager = data_manager
        self.course_colors = {}
        self.last_sections_list = []
        self.init_ui()

    def init_ui(self):
        self.setHorizontalHeaderLabels(self.DAYS)
        self.setVerticalHeaderLabels([ts for ts in self.TIME_SLOTS])

        self.horizontalHeader().setSectionResizeMode(RESIZE_STRETCH)
        self.verticalHeader().setSectionResizeMode(RESIZE_FIXED)
        self.verticalHeader().setDefaultSectionSize(64)

        self.setEditTriggers(NO_EDIT_TRIGGERS)
        self.setSelectionMode(NO_SELECTION)
        self.setFocusPolicy(NO_FOCUS)

        self.clear_schedule()

    def clear_schedule(self):
        self.last_sections_list = []
        self.clearContents()
        for row in range(self.rowCount()):
            for col in range(self.columnCount()):
                item = QTableWidgetItem()
                item.setFlags(ITEM_ENABLED)
                item.setTextAlignment(ALIGN_CENTER)
                self.setItem(row, col, item)
                self.render_non_course_cell(row, col)

    def refresh_theme(self):
        self.course_colors.clear()
        if self.last_sections_list:
            self.display_schedule(self.last_sections_list)
        else:
            self.clear_schedule()

    def _get_course_color(self, course_code):
        colors = StyleManager.get_course_colors()
        if course_code not in self.course_colors:
            color_idx = len(self.course_colors) % len(colors)
            self.course_colors[course_code] = colors[color_idx]
        return self.course_colors[course_code]

    def _match_time_slot_row(self, raw_time_slot):
        cleaned = raw_time_slot.replace('/', '-').strip()
        parts = cleaned.split('-')
        start_hour = parts[0].strip() if parts else ""

        for row_idx, slot_label in enumerate(self.TIME_SLOTS):
            if start_hour and start_hour in slot_label:
                return row_idx
        
        for row_idx, slot_label in enumerate(self.TIME_SLOTS):
            if slot_label.startswith(start_hour[:2]):
                return row_idx

        return -1

    def on_slot_clicked(self, day_name, time_slot, entries, custom_block=None):
        """Opens the detail/conflict dialog for the clicked timetable cell."""
        dialog = ConflictDetailDialog(
            day_name, time_slot, entries, custom_block=custom_block, data_manager=self.data_manager, parent=self
        )
        try:
            if hasattr(dialog, 'exec'):
                dialog.exec()
            else:
                dialog.exec_()
        finally:
            if self.window():
                self.window().activateWindow()
                self.window().raise_()

        if getattr(dialog, 'custom_block_modified', False):
            QTimer.singleShot(0, lambda: (
                self.display_schedule(self.last_sections_list),
                self.custom_blocks_changed.emit()
            ))

    def on_empty_cell_clicked(self, day_name, time_slot):
        """Opens the custom block edit dialog to add a new custom note/block."""
        dlg = CustomBlockEditDialog(day_name, time_slot, current_block=None, parent=self)
        try:
            if dlg.exec():
                if dlg.result_data and self.data_manager:
                    if dlg.result_data.get("all_weekdays"):
                        for d in ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"]:
                            self.data_manager.set_custom_schedule_block(
                                d, time_slot, dlg.result_data["title"], dlg.result_data.get("note", ""), dlg.result_data.get("color", "amber")
                            )
                    else:
                        self.data_manager.set_custom_schedule_block(
                            day_name, time_slot, dlg.result_data["title"], dlg.result_data.get("note", ""), dlg.result_data.get("color", "amber")
                        )
                    QTimer.singleShot(0, lambda: (
                        self.display_schedule(self.last_sections_list),
                        self.custom_blocks_changed.emit()
                    ))
        finally:
            if self.window():
                self.window().activateWindow()
                self.window().raise_()

    def on_custom_block_clicked(self, day_name, time_slot, current_block):
        """Opens the custom block edit dialog to update or delete an existing block."""
        dlg = CustomBlockEditDialog(day_name, time_slot, current_block=current_block, parent=self)
        try:
            if dlg.exec():
                if getattr(dlg, 'deleted', False) and self.data_manager:
                    self.data_manager.delete_custom_schedule_block(day_name, time_slot)
                    QTimer.singleShot(0, lambda: (
                        self.display_schedule(self.last_sections_list),
                        self.custom_blocks_changed.emit()
                    ))
                elif dlg.result_data and self.data_manager:
                    if dlg.result_data.get("all_weekdays"):
                        for d in ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"]:
                            self.data_manager.set_custom_schedule_block(
                                d, time_slot, dlg.result_data["title"], dlg.result_data.get("note", ""), dlg.result_data.get("color", "amber")
                            )
                    else:
                        self.data_manager.set_custom_schedule_block(
                            day_name, time_slot, dlg.result_data["title"], dlg.result_data.get("note", ""), dlg.result_data.get("color", "amber")
                        )
                    QTimer.singleShot(0, lambda: (
                        self.display_schedule(self.last_sections_list),
                        self.custom_blocks_changed.emit()
                    ))
        finally:
            if self.window():
                self.window().activateWindow()
                self.window().raise_()

    def render_empty_cell(self, row, col, day_name, time_slot_label, is_dark):
        """Renders an interactive empty cell."""
        widget = QFrame()
        widget.setObjectName("emptyScheduleCell")
        widget.setCursor(POINTING_HAND_CURSOR)
        hover_bg = "rgba(255, 255, 255, 0.07)" if is_dark else "rgba(0, 40, 85, 0.05)"
        hover_border = "#64748b" if is_dark else "#94a3b8"
        widget.setStyleSheet(f"""
            QFrame#emptyScheduleCell {{
                background-color: transparent;
                border: 1px solid transparent;
                border-radius: 6px;
                margin: 2px;
            }}
            QFrame#emptyScheduleCell:hover {{
                background-color: {hover_bg};
                border: 1px dashed {hover_border};
            }}
        """)
        widget.setToolTip(f"{day_name} {time_slot_label}\nTıklayarak bu kutuyu düzenleyin (örn. Yemek arası, çalışma saati)")
        widget.mousePressEvent = lambda event, d=day_name, t=time_slot_label: QTimer.singleShot(0, lambda: self.on_empty_cell_clicked(d, t))
        self.setCellWidget(row, col, widget)

    def render_custom_block_cell(self, row, col, day_name, time_slot_label, block, is_dark):
        """Renders a user-defined custom block alone on the timetable."""
        bg_hex, border_hex, text_hex = StyleManager.get_custom_block_style(block.get("color", "amber"))

        widget = QFrame()
        widget.setObjectName("customBlockCell")
        widget.setCursor(POINTING_HAND_CURSOR)
        widget.setStyleSheet(f"""
            QFrame#customBlockCell {{
                background-color: {bg_hex};
                border: 2px solid {border_hex};
                border-radius: 6px;
                margin: 2px;
            }}
            QFrame#customBlockCell:hover {{
                border: 2px solid {'#ffffff' if is_dark else '#000000'};
            }}
            QLabel {{
                border: none;
                background: transparent;
            }}
        """)
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(4, 3, 4, 3)
        layout.setSpacing(1)

        lbl_title = QLabel(f"<b>{block['title']}</b>")
        lbl_title.setStyleSheet(f"color: {text_hex}; font-size: 11px; font-weight: bold; border: none; background: transparent;")
        lbl_title.setAlignment(ALIGN_CENTER)

        divider = QFrame()
        divider.setObjectName("customBlockDivider")
        divider.setStyleSheet(f"background-color: {border_hex}; max-height: 1px; min-height: 1px; border: none; margin: 1px 2px;")

        note_color = "#e2e8f0" if is_dark else text_hex
        lbl_note = QLabel(block.get("note", ""))
        lbl_note.setStyleSheet(f"color: {note_color}; font-size: 10px; opacity: 0.9; border: none; background: transparent;")
        lbl_note.setAlignment(ALIGN_CENTER)
        lbl_note.setWordWrap(True)

        layout.addWidget(lbl_title)
        layout.addWidget(divider)
        layout.addWidget(lbl_note)

        tooltip_lines = [
            f"{block['title']}",
            f"Saat: {time_slot_label}",
        ]
        if block.get("note"):
            tooltip_lines.append(f"Not: {block['note']}")
        tooltip_lines.append("Düzenlemek veya silmek için tıklayın")
        widget.setToolTip("\n".join(tooltip_lines))

        widget.mousePressEvent = lambda event, d=day_name, t=time_slot_label, b=block: QTimer.singleShot(0, lambda: self.on_custom_block_clicked(d, t, b))
        self.setCellWidget(row, col, widget)

    def render_non_course_cell(self, row, col):
        """Renders either a user-defined custom block or an interactive empty cell."""
        day_name = self.DAYS[col]
        time_slot_label = self.TIME_SLOTS[row]
        is_dark = StyleManager.get_active_theme() == "modern"

        custom_blocks = self.data_manager.get_custom_schedule_blocks() if self.data_manager else {}
        block_key = f"{day_name}:{time_slot_label}"

        if block_key in custom_blocks:
            self.render_custom_block_cell(row, col, day_name, time_slot_label, custom_blocks[block_key], is_dark)
        else:
            self.render_empty_cell(row, col, day_name, time_slot_label, is_dark)

    def render_course_cell(self, row, col, day_name, time_slot_label, entries, is_dark):
        """Renders a standard non-conflicting course cell."""
        sec, slot = entries[0]
        color_tuple = self._get_course_color(sec.course_code)
        if len(color_tuple) == 3:
            bg_hex, border_hex, text_hex = color_tuple
        else:
            bg_hex, border_hex = color_tuple
            text_hex = border_hex

        widget = QFrame()
        widget.setObjectName("courseCell")
        widget.setCursor(POINTING_HAND_CURSOR)
        widget.setStyleSheet(f"""
            QFrame#courseCell {{
                background-color: {bg_hex};
                border: 2px solid {border_hex};
                border-radius: 6px;
                margin: 2px;
            }}
            QFrame#courseCell:hover {{
                border: 2px solid {'#ffffff' if is_dark else '#000000'};
            }}
            QLabel {{
                border: none;
                background: transparent;
            }}
        """)
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(4, 3, 4, 3)
        layout.setSpacing(1)

        header_text = sec.course_code
        if len(entries) == 1:
            header_text += f" (S{sec.section_no})"
        else:
            header_text += f" ({len(entries)} Şube)"

        lbl_code = QLabel(f"<b>{header_text}</b>")
        lbl_code.setStyleSheet(f"color: {text_hex}; font-size: 11px; font-weight: bold; border: none; background: transparent;")
        lbl_code.setAlignment(ALIGN_CENTER)

        divider = QFrame()
        divider.setObjectName("courseDivider")
        divider.setStyleSheet(f"background-color: {border_hex}; max-height: 1px; min-height: 1px; border: none; margin: 1px 2px;")

        inst_name = sec.instructor or "Belirsiz"
        if len(entries) > 1:
            inst_name = f"{inst_name} (+{len(entries)-1})"

        lbl_inst = QLabel(inst_name)
        lbl_inst.setStyleSheet(f"color: {text_hex}; font-size: 10px; opacity: 0.9; border: none; background: transparent;")
        lbl_inst.setAlignment(ALIGN_CENTER)
        lbl_inst.setWordWrap(True)

        layout.addWidget(lbl_code)
        layout.addWidget(divider)
        layout.addWidget(lbl_inst)

        room_text = getattr(slot, 'classroom', '') or getattr(sec, 'classroom', '')
        if not room_text and len(entries) > 1:
            rooms = [getattr(sl, 'classroom', '') or getattr(s, 'classroom', '') for s, sl in entries]
            rooms = [r for r in rooms if r]
            if rooms:
                room_text = rooms[0]

        if room_text:
            room_fg = "#4ade80" if is_dark else "#15803d"
            lbl_room = QLabel(f"{room_text}")
            lbl_room.setStyleSheet(f"color: {room_fg}; font-size: 9px; font-weight: bold; border: none; background: transparent;")
            lbl_room.setAlignment(ALIGN_CENTER)
            layout.addWidget(lbl_room)

        tooltip_lines = [
            f"{sec.course_code} - Section {sec.section_no}",
            f"Öğretim Görevlisi: {sec.instructor}",
            f"Saat: {slot.time_slot}",
        ]
        if room_text:
            tooltip_lines.append(f"Sınıf/Derslik: {room_text}")
        tooltip_lines.append("Detayları görmek için tıklayın")

        for s, sl in entries:
            s_room = getattr(sl, 'classroom', '') or getattr(s, 'classroom', '')
            r_str = f" - {s_room}" if s_room else ""
            tooltip_lines.append(f"• Sec {s.section_no}: {s.instructor}{r_str}")
        widget.setToolTip("\n".join(tooltip_lines))

        # Bind click event
        widget.mousePressEvent = lambda event, d=day_name, t=time_slot_label, e=entries: QTimer.singleShot(0, lambda: self.on_slot_clicked(d, t, e, custom_block=None))
        self.setCellWidget(row, col, widget)

    def render_conflict_cell(self, row, col, day_name, time_slot_label, entries, custom_block=None, is_dark=False):
        """Renders a conflict cell (between multiple courses or between course(s) and a student custom block)."""
        conf_bg, conf_border, conf_text = StyleManager.get_conflict_style()

        widget = QFrame()
        widget.setObjectName("conflictCell")
        widget.setCursor(POINTING_HAND_CURSOR)
        widget.setStyleSheet(f"""
            QFrame#conflictCell {{
                background-color: {conf_bg};
                border: 2px solid {conf_border};
                border-radius: 6px;
                margin: 2px;
            }}
            QFrame#conflictCell:hover {{
                border: 2px solid #ef4444;
            }}
            QLabel {{
                border: none;
                background: transparent;
            }}
        """)
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(4, 2, 4, 2)
        layout.setSpacing(1)

        lbl_alert = QLabel("<b>ÇAKIŞMA!</b>")
        lbl_alert.setStyleSheet(f"color: {conf_text}; font-size: 11px; border: none; background: transparent;")
        lbl_alert.setAlignment(ALIGN_CENTER)

        conf_divider = QFrame()
        conf_divider.setObjectName("conflictDivider")
        conf_divider.setStyleSheet(f"background-color: {conf_border}; max-height: 1px; min-height: 1px; border: none; margin: 1px 2px;")

        sec_codes = ", ".join(sorted(set(f"{s.course_code}(S{s.section_no})" for s, _ in entries)))

        if custom_block:
            details_html = f"{sec_codes}<br><span style='font-size: 9px; font-weight: bold;'>{custom_block['title']}</span>"
            lbl_details = QLabel(details_html)
            lbl_details.setStyleSheet(f"color: {conf_text}; font-size: 10px; border: none; background: transparent;")
            lbl_details.setAlignment(ALIGN_CENTER)
            lbl_details.setWordWrap(True)

            lbl_hint = QLabel("İncele & Çöz")
            lbl_hint.setStyleSheet(f"color: {conf_text}; font-size: 9px; font-style: italic; border: none; background: transparent;")
            lbl_hint.setAlignment(ALIGN_CENTER)

            tooltip_lines = [
                "DERS VE KİŞİSEL ETKİNLİK ÇAKIŞMASI!",
                f"Kişisel Etkinlik: {custom_block['title']}" + (f" ({custom_block['note']})" if custom_block.get('note') else ""),
                f"Saat: {time_slot_label}",
                "Çakışan Dersler:",
            ]
            for s, sl in entries:
                s_room = getattr(sl, 'classroom', '') or getattr(s, 'classroom', '')
                r_str = f" [{s_room}]" if s_room else ""
                tooltip_lines.append(f"• {s.course_code} Sec {s.section_no} ({s.instructor}){r_str}")
            tooltip_lines.append("Detayları görmek ve etkinliği düzenlemek için tıklayın")

        else:
            lbl_details = QLabel(sec_codes)
            lbl_details.setStyleSheet(f"color: {conf_text}; font-size: 10px; border: none; background: transparent;")
            lbl_details.setAlignment(ALIGN_CENTER)
            lbl_details.setWordWrap(True)

            lbl_hint = QLabel("İncelemek için tıkla")
            lbl_hint.setStyleSheet(f"color: {conf_text}; font-size: 9px; font-style: italic; border: none; background: transparent;")
            lbl_hint.setAlignment(ALIGN_CENTER)

            tooltip_lines = [
                "FARKLI DERSLER ARASINDA ÇAKIŞMA!",
                "Çakışan dersleri ve alternatif şubeleri görmek için tıklayın:",
            ]
            for s, sl in entries:
                s_room = getattr(sl, 'classroom', '') or getattr(s, 'classroom', '')
                r_str = f" [{s_room}]" if s_room else ""
                tooltip_lines.append(f"• {s.course_code} Section {s.section_no} ({s.instructor}){r_str}")

        layout.addWidget(lbl_alert)
        layout.addWidget(conf_divider)
        layout.addWidget(lbl_details)
        layout.addWidget(lbl_hint)

        widget.setToolTip("\n".join(tooltip_lines))
        widget.mousePressEvent = lambda event, d=day_name, t=time_slot_label, e=entries, cb=custom_block: QTimer.singleShot(0, lambda: self.on_slot_clicked(d, t, e, custom_block=cb))
        self.setCellWidget(row, col, widget)

    def display_schedule(self, sections_list):
        self.last_sections_list = sections_list
        self.clearContents()

        cell_map = {}

        for sec in sections_list:
            for slot in sec.slots:
                day_col = -1
                for col_idx, d in enumerate(self.DAYS):
                    if d.lower() in slot.day.lower() or slot.day.lower() in d.lower():
                        day_col = col_idx
                        break

                if day_col == -1:
                    continue

                row_idx = self._match_time_slot_row(slot.time_slot)
                if row_idx == -1:
                    continue

                cell_key = (row_idx, day_col)
                if cell_key not in cell_map:
                    cell_map[cell_key] = []
                cell_map[cell_key].append((sec, slot))

        custom_blocks = self.data_manager.get_custom_schedule_blocks() if self.data_manager else {}
        is_dark = StyleManager.get_active_theme() == "modern"

        for row in range(len(self.TIME_SLOTS)):
            for col in range(len(self.DAYS)):
                cell_key = (row, col)
                day_name = self.DAYS[col]
                time_slot_label = self.TIME_SLOTS[row]
                block_key = f"{day_name}:{time_slot_label}"
                custom_block = custom_blocks.get(block_key)

                has_courses = cell_key in cell_map
                has_custom = custom_block is not None

                if not has_courses and not has_custom:
                    self.render_empty_cell(row, col, day_name, time_slot_label, is_dark)
                elif not has_courses and has_custom:
                    self.render_custom_block_cell(row, col, day_name, time_slot_label, custom_block, is_dark)
                elif has_courses and has_custom:
                    # CONFLICT between course(s) and student custom block!
                    entries = cell_map[cell_key]
                    self.render_conflict_cell(row, col, day_name, time_slot_label, entries, custom_block=custom_block, is_dark=is_dark)
                else:
                    # Has courses and NO custom block
                    entries = cell_map[cell_key]
                    distinct_course_codes = set(sec.course_code for sec, _ in entries)
                    if len(distinct_course_codes) <= 1:
                        self.render_course_cell(row, col, day_name, time_slot_label, entries, is_dark)
                    else:
                        self.render_conflict_cell(row, col, day_name, time_slot_label, entries, custom_block=None, is_dark=is_dark)

