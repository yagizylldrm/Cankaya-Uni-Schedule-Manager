import json
import os

from gui.qt_compat import (
    QMainWindow, QWidget, QHBoxLayout, QVBoxLayout, QPushButton,
    QLabel, QSplitter, QMessageBox, QProgressDialog, QFileDialog,
    QFrame, Qt, QThread, pyqtSignal, QPixmap, QIcon, HORIZONTAL, WINDOW_MODAL,
    QApplication
)

from data_manager import DataManager
from scheduler_engine import SchedulerEngine
from scraper import CankayaScraper
from gui.styles import StyleManager, ModernStyle, CankayaStyle
from gui.timetable_widget import TimetableWidget
from gui.course_search_panel import CourseSearchPanel
from gui.combination_bar import CombinationBar


class ScraperThread(QThread):
    progress_signal = pyqtSignal(int, int, str)
    finished_signal = pyqtSignal(bool, int, int, str)

    def __init__(self, data_manager, dept_list=None):
        super().__init__()
        self.data_manager = data_manager
        self.dept_list = dept_list
        self._is_cancelled = False

    def cancel(self):
        self._is_cancelled = True

    def run(self):
        def cancel_check():
            return self._is_cancelled

        try:
            # ==============================================================
            # AŞAMA 1: Bilgi Paketi Müfredat, Seçmeli Havuzları & Ön Koşul
            # ==============================================================
            self.progress_signal.emit(5, 100, "1/2: Bilgi Paketi müfredat ve seçmeli havuzları güncelleniyor...")

            from curriculum_fetcher import CurriculumFetcher
            curr_fetcher = CurriculumFetcher()

            def curr_callback(cur, total, msg):
                pct = int(5 + (cur / max(1, total)) * 40)
                self.progress_signal.emit(pct, 100, f"1/2: {msg}")

            try:
                c_ok, c_depts, c_details = curr_fetcher.fetch_all_curricula(
                    progress_callback=curr_callback,
                    dept_list=self.dept_list,
                    cancel_check=cancel_check
                )
                if c_ok:
                    self.data_manager.reload_official_curricula()
                    from prerequisite_manager import PrerequisiteManager
                    PrerequisiteManager.reload_official_prerequisites()
            except Exception as e:
                print(f"[ScraperThread] Bilgi Paketi güncelleme uyarısı: {e}")

            if self._is_cancelled:
                self.finished_signal.emit(False, 0, 0, "İşlem kullanıcı tarafından iptal edildi.")
                return

            # ==============================================================
            # AŞAMA 2: cankaya.edu.tr/dersler/ Açılan Dersler & Şubeler
            # ==============================================================
            self.progress_signal.emit(50, 100, "2/2: cankaya.edu.tr/dersler/ üzerinden açılan dersler çekiliyor...")

            scraper = CankayaScraper()
            def scrape_callback(cur, total, msg):
                pct = int(50 + (cur / max(1, total)) * 45)
                self.progress_signal.emit(pct, 100, f"2/2: {msg}")

            raw_entries = scraper.fetch_all_schedules(
                progress_callback=scrape_callback,
                dept_list=self.dept_list,
                cancel_check=cancel_check
            )

            if self._is_cancelled:
                self.finished_signal.emit(False, 0, 0, "İşlem kullanıcı tarafından iptal edildi.")
                return

            if not raw_entries:
                self.finished_signal.emit(False, 0, 0, "Açılan dersler sayfasından herhangi bir ders verisi alınamadı.")
                return

            # Process and save in BACKGROUND thread so GUI thread never freezes!
            self.progress_signal.emit(98, 100, "Veriler işleniyor ve diske kaydediliyor...")
            self.data_manager.process_raw_entries(raw_entries)

            c_count = len(self.data_manager.courses)
            d_count = len(self.data_manager.departments)
            self.progress_signal.emit(100, 100, "Tamamlandı!")
            self.finished_signal.emit(True, c_count, d_count, "Başarılı")

        except Exception as e:
            self.finished_signal.emit(False, 0, 0, str(e))


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Çankaya Üniversitesi - Haftalık Ders Programı Oluşturucu")

        # Responsive window sizing & screen centering
        screen = QApplication.primaryScreen()
        if screen:
            avail = screen.availableGeometry()
            self.target_w = min(1260, avail.width() - 40)
            self.target_h = min(820, avail.height() - 40)
            self.resize(self.target_w, self.target_h)
            # Center on screen so no part is off-screen
            pos_x = avail.x() + (avail.width() - self.target_w) // 2
            pos_y = avail.y() + (avail.height() - self.target_h) // 2
            self.move(pos_x, pos_y)
        else:
            self.target_w = 1240
            self.target_h = 800
            self.resize(self.target_w, self.target_h)

        self.data_manager = DataManager()
        self.scheduler_engine = SchedulerEngine()
        self.current_combinations = []
        self.scraper_thread = None

        saved_theme = self.data_manager.student_profile.get("theme", "cankaya")
        StyleManager.set_active_theme(saved_theme)

        self.init_ui()
        self.setStyleSheet(StyleManager.get_stylesheet())

    def init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(8)

        # 1. TOP HEADER TOOLBAR
        header_frame = QFrame()
        header_frame.setObjectName("panelFrame")
        header_layout = QHBoxLayout(header_frame)
        header_layout.setContentsMargins(10, 6, 10, 6)
        header_layout.setSpacing(8)

        lbl_title = QLabel("Çankaya Üniversitesi Ders Programı Oluşturucu")
        lbl_title.setObjectName("titleLabel")
        header_layout.addWidget(lbl_title)

        header_layout.addStretch()

        active_theme = StyleManager.get_active_theme()
        theme_btn_text = "Açık Tema" if active_theme == "cankaya" else "Karanlık Tema"
        self.btn_theme = QPushButton(theme_btn_text)
        self.btn_theme.setToolTip("Açık Tema (Çankaya) ile Karanlık Tema (Eski Görünüm) arasında geçiş yapar")
        self.btn_theme.clicked.connect(self.toggle_theme)
        header_layout.addWidget(self.btn_theme)

        self.btn_transcript = QPushButton("Transkript & Ön Koşul")
        self.btn_transcript.setToolTip("Transkriptinizi yükleyerek verdiğiniz dersleri kaydedin ve derslerin ön koşullarını denetleyin")
        self.btn_transcript.clicked.connect(self.open_transcript_dialog)
        header_layout.addWidget(self.btn_transcript)

        self.btn_refresh = QPushButton("Verileri Çek")
        self.btn_refresh.setToolTip("Çankaya web sitesinden güncel ders programlarını çeker")
        self.btn_refresh.clicked.connect(self.start_web_scraping)
        header_layout.addWidget(self.btn_refresh)

        self.btn_generate = QPushButton("Program Oluştur")
        self.btn_generate.setObjectName("primaryButton")
        self.btn_generate.clicked.connect(self.generate_schedule_combinations)
        header_layout.addWidget(self.btn_generate)

        self.btn_export = QPushButton("Dışa Aktar")
        self.btn_export.setToolTip("Haftalık programı PNG görseli veya JSON olarak kaydeder")
        self.btn_export.clicked.connect(self.export_schedule)
        header_layout.addWidget(self.btn_export)

        main_layout.addWidget(header_frame)

        # 2. SPLITTER MAIN CONTENT
        splitter = QSplitter(HORIZONTAL)

        # Left Panel
        self.search_panel = CourseSearchPanel(self.data_manager)
        self.search_panel.courses_changed.connect(self.on_basket_courses_changed)
        splitter.addWidget(self.search_panel)

        # Right Panel
        right_container = QWidget()
        right_layout = QVBoxLayout(right_container)
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(6)

        # Combination Navigation Bar
        self.combination_bar = CombinationBar()
        self.combination_bar.index_changed.connect(self.display_combination_by_index)
        self.combination_bar.preferences_changed.connect(self.on_preferences_changed)
        right_layout.addWidget(self.combination_bar)

        # Timetable Grid
        self.timetable_widget = TimetableWidget(data_manager=self.data_manager)
        self.timetable_widget.custom_blocks_changed.connect(self.on_custom_blocks_updated)
        right_layout.addWidget(self.timetable_widget)

        splitter.addWidget(right_container)

        left_w = min(320, int(self.target_w * 0.26))
        splitter.setSizes([left_w, self.target_w - left_w])
        splitter.setCollapsible(0, False)
        splitter.setCollapsible(1, False)
        main_layout.addWidget(splitter)

        if not self.data_manager.courses:
            QMessageBox.information(
                self,
                "Hoş Geldiniz",
                "Henüz kaydedilmiş ders verisi bulunamadı.\nLütfen 'Webden Verileri Çek' butonuna basarak ders bilgilerini indirin."
            )

    def start_web_scraping(self):
        msg_box = QMessageBox(self)
        msg_box.setWindowTitle("Veri Çekme Modu")
        msg_box.setText("Nasıl bir güncelleme yapmak istersiniz?")
        
        btn_quick = msg_box.addButton("Hızlı Güncelleme (Ana Bölümler ~15 sn)", QMessageBox.ButtonRole.ActionRole)
        btn_full = msg_box.addButton("Tüm Üniversite (100+ Bölüm ~1-2 dk)", QMessageBox.ButtonRole.ActionRole)
        btn_cancel = msg_box.addButton("İptal", QMessageBox.ButtonRole.RejectRole)
        
        msg_box.exec()
        clicked = msg_box.clickedButton()

        if clicked == btn_cancel:
            return

        dept_list = None
        if clicked == btn_quick:
            dept_list = ["CENG", "SENG", "ECE", "IE", "ME", "MATH", "PHYS", "CHEM", "ENG", "TURK", "AİIT", "MAN", "LAW"]

        self.progress_dialog = QProgressDialog("Veriler indiriliyor...", "İptal", 0, 100, self)
        self.progress_dialog.setWindowModality(WINDOW_MODAL)
        self.progress_dialog.setAutoClose(False)
        self.progress_dialog.setAutoReset(False)
        self.progress_dialog.setValue(0)
        self.progress_dialog.show()

        self.scraper_thread = ScraperThread(self.data_manager, dept_list=dept_list)
        self.scraper_thread.progress_signal.connect(self.on_scraping_progress)
        self.scraper_thread.finished_signal.connect(self.on_scraping_finished)
        self.progress_dialog.canceled.connect(self.scraper_thread.cancel)
        
        self.scraper_thread.start()

    def on_scraping_progress(self, current, total, msg):
        percent = int((current / max(1, total)) * 100)
        self.progress_dialog.setValue(percent)
        self.progress_dialog.setLabelText(msg)

    def on_scraping_finished(self, success, course_count, dept_count, message):
        self.progress_dialog.close()
        if success:
            self.search_panel.populate_departments()
            self.search_panel.on_search_changed()
            QMessageBox.information(
                self,
                "Başarılı",
                f"Bilgi Paketi ve Açılan Dersler başarıyla güncellendi!\n\n"
                f"• Aşama 1: Bilgi Paketi müfredatları, teknik/sosyal seçmeli havuzları ve ön koşul kuralları güncellendi.\n"
                f"• Aşama 2: Açılan {course_count} ders ve {dept_count} bölüm ders programı sisteme aktarıldı."
            )
        else:
            if not self.scraper_thread or not self.scraper_thread._is_cancelled:
                QMessageBox.warning(self, "Hata", f"Veriler güncellenirken sorun oluştu:\n{message}")

    def on_basket_courses_changed(self):
        target_dict = self.search_panel.get_selected_target_dict()
        if not target_dict:
            self.timetable_widget.clear_schedule()
            self.combination_bar.set_combinations_count(0)
            return

        all_manual_sections = []
        for c_code, sec_list in target_dict.items():
            all_manual_sections.extend(sec_list)

        self.timetable_widget.display_schedule(all_manual_sections)

    def on_custom_blocks_updated(self):
        """Called whenever the student adds, edits, or removes a custom schedule block."""
        if self.current_combinations:
            # Re-generate schedule combinations with the new custom blocks
            self.generate_schedule_combinations(silent=True)
        else:
            self.on_basket_courses_changed()

    def open_transcript_dialog(self):
        from gui.transcript_dialog import TranscriptDialog
        dlg = TranscriptDialog(self.data_manager, parent=self)
        dlg.transcript_updated.connect(self.on_transcript_updated)
        try:
            if hasattr(dlg, 'exec'):
                dlg.exec()
            else:
                dlg.exec_()
        finally:
            self.activateWindow()
            self.raise_()

    def on_transcript_updated(self):
        self.search_panel.populate_departments()
        self.search_panel.on_search_changed()
        self.search_panel.update_basket_tree()
        if self.current_combinations:
            self.generate_schedule_combinations(silent=True)
        else:
            self.on_basket_courses_changed()

    def generate_schedule_combinations(self, silent=False):
        try:
            target_dict = self.search_panel.get_selected_target_dict()
            if not target_dict:
                if not silent:
                    QMessageBox.warning(self, "Ders Seçilmedi", "Lütfen önce sol panelden alınmak istenen dersleri sepete ekleyin.")
                return

            # Check prerequisites for selected courses
            if not silent:
                missing_prereqs = []
                for c_code in target_dict.keys():
                    p_info = self.data_manager.check_course_prerequisites(c_code)
                    if not p_info.get("can_take", True):
                        missing_prereqs.append(f"• <b>{c_code}</b>: {p_info['message']}")

                if missing_prereqs:
                    warning_text = (
                        "Sepetinizdeki bazı derslerin ön koşulları transkriptinizde eksik görünmektedir:\n\n" +
                        "\n".join(missing_prereqs) +
                        "\n\nYine de bu dersler için program oluşturmak istiyor musunuz?"
                    )
                    res = QMessageBox.question(
                        self,
                        "Ön Koşul Eksik Uyarısı",
                        warning_text,
                        QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                        QMessageBox.StandardButton.Yes
                    )
                    if res != QMessageBox.StandardButton.Yes:
                        return

            prefs = {
                "no_morning": self.combination_bar.chk_no_morning.isChecked(),
                "free_friday": self.combination_bar.chk_free_friday.isChecked(),
                "free_monday": self.combination_bar.chk_free_monday.isChecked(),
            }

            custom_blocks = self.data_manager.get_custom_schedule_blocks() if self.data_manager else {}
            self.current_combinations = self.scheduler_engine.generate_combinations(
                target_dict, preferences=prefs, custom_blocks=custom_blocks
            )
            count = len(self.current_combinations)
            self.combination_bar.set_combinations_count(count)

            if count > 0:
                self.display_combination_by_index(0)
                if not silent:
                    QMessageBox.information(self, "Kombinasyon Üretildi", f"Çakışma oluşturmayan toplam {count} adet ders programı kombinasyonu bulundu!")
            else:
                self.timetable_widget.clear_schedule()
                if not silent:
                    # Check if custom blocks caused conflicts for any selected courses
                    custom_block_clash_courses = []
                    if custom_blocks:
                        for c_code, sec_list in target_dict.items():
                            if sec_list and all(self.scheduler_engine.section_overlaps_custom_blocks(s, custom_blocks)[0] for s in sec_list):
                                custom_block_clash_courses.append(c_code)

                    if custom_block_clash_courses:
                        clash_info = ", ".join(custom_block_clash_courses)
                        msg = (
                            f"Seçtiğiniz derslerden bazılarının tüm şubeleri eklediğiniz kişisel etkinliklerle çakışmaktadır:\n\n"
                            f"Çakışan dersler: {clash_info}\n\n"
                            f"Lütfen tablodaki ilgili saatlerdeki kişisel etkinliğinizi düzenlemeyi/kaldırmayı veya farklı dersler seçmeyi deneyin."
                        )
                    else:
                        msg = (
                            "Seçtiğiniz dersler/section'lar veya kişisel etkinlikler arasında çakışma oluşturmayan bir kombinasyon bulunamadı.\n"
                            "Lütfen farklı section'lar seçmeyi, kişisel etkinliklerinizi düzenlemeyi veya filtreleri esnetmeyi deneyin."
                        )
                    QMessageBox.warning(self, "Çakışmasız Program Bulunamadı", msg)
        finally:
            self.activateWindow()
            self.raise_()

    def on_preferences_changed(self, prefs):
        target_dict = self.search_panel.get_selected_target_dict()
        if target_dict:
            self.generate_schedule_combinations(silent=True)

    def display_combination_by_index(self, index):
        if 0 <= index < len(self.current_combinations):
            combo_sections = self.current_combinations[index]
            self.timetable_widget.display_schedule(combo_sections)

            # Calculate total credits and ECTS for current combination
            total_credit = 0
            total_ects = 0
            distinct_courses = set()
            for sec in combo_sections:
                if sec.course_code not in distinct_courses:
                    distinct_courses.add(sec.course_code)
                    cr, ec = self.data_manager.get_course_credits(sec.course_code)
                    total_credit += cr
                    total_ects += ec

            self.combination_bar.set_combination_credits(len(distinct_courses), total_credit, total_ects)
        else:
            self.combination_bar.set_combination_credits(0, 0, 0)

    def export_schedule(self):
        if self.timetable_widget.findChildren(QWidget) == 0:
            QMessageBox.warning(self, "Program Boş", "Dışa aktarmak için önce bir ders programı oluşturun.")
            self.activateWindow()
            self.raise_()
            return

        try:
            filepath, selected_filter = QFileDialog.getSaveFileName(
                self, "Ders Programını Kaydet", "haftalik_program.png", "PNG Görsel (*.png);;JSON Dosyası (*.json)"
            )
            if not filepath:
                return

            if filepath.endswith('.json'):
                current_combo_idx = self.combination_bar.current_index
                sections = self.current_combinations[current_combo_idx] if 0 <= current_combo_idx < len(self.current_combinations) else []
                data = [s.to_dict() for s in sections]
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                QMessageBox.information(self, "Kaydedildi", f"Program JSON olarak kaydedildi:\n{filepath}")
            else:
                pixmap = self.timetable_widget.grab()
                pixmap.save(filepath, "PNG")
                QMessageBox.information(self, "Kaydedildi", f"Program görseli kaydedildi:\n{filepath}")
        except Exception as e:
            QMessageBox.critical(self, "Hata", f"Dosya kaydedilirken hata oluştu: {e}")
        finally:
            self.activateWindow()
            self.raise_()

    def toggle_theme(self):
        new_theme = StyleManager.toggle_theme()
        self.setStyleSheet(StyleManager.get_stylesheet())
        self.data_manager.student_profile["theme"] = new_theme
        self.data_manager.save_student_profile(
            self.data_manager.student_profile.get("primary_dept", "CENG"),
            self.data_manager.student_profile.get("secondary_dept", "YOK"),
            self.data_manager.student_profile.get("secondary_type", "YOK")
        )
        self.btn_theme.setText("Açık Tema (Çankaya)" if new_theme == "cankaya" else "Karanlık Tema")
        self.timetable_widget.refresh_theme()
        if hasattr(self.search_panel, "refresh_theme"):
            self.search_panel.refresh_theme()
