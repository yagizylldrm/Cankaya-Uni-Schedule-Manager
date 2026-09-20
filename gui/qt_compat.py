import os
import sys

# Auto-configure PySide6 / Qt 6 plugin environment before Qt module loading
try:
    import PySide6
    pyside_dir = os.path.dirname(PySide6.__file__)
    plugins_dir = os.path.join(pyside_dir, 'Qt', 'plugins')

    # Remove overriding QT_QPA_PLATFORM_PLUGIN_PATH if set
    os.environ.pop('QT_QPA_PLATFORM_PLUGIN_PATH', None)
    if os.path.exists(plugins_dir):
        os.environ['QT_PLUGIN_PATH'] = plugins_dir

    from PySide6 import QtWidgets, QtCore, QtGui
    from PySide6.QtWidgets import (
        QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout, QPushButton,
        QLabel, QSplitter, QMessageBox, QProgressDialog, QFileDialog, QFrame,
        QLineEdit, QComboBox, QListWidget, QListWidgetItem, QGroupBox, QTreeWidget,
        QTreeWidgetItem, QAbstractItemView, QCheckBox, QTableWidget, QTableWidgetItem,
        QHeaderView, QMenu, QDialog, QScrollArea, QTextEdit, QCompleter
    )
    from PySide6.QtCore import Qt, QThread, QTimer, Signal as pyqtSignal
    from PySide6.QtGui import QColor, QFont, QBrush, QPixmap, QIcon
    QT_BINDING = "PySide6"
except ImportError:
    try:
        from PyQt6 import QtWidgets, QtCore, QtGui
        from PyQt6.QtWidgets import (
            QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout, QPushButton,
            QLabel, QSplitter, QMessageBox, QProgressDialog, QFileDialog, QFrame,
            QLineEdit, QComboBox, QListWidget, QListWidgetItem, QGroupBox, QTreeWidget,
            QTreeWidgetItem, QAbstractItemView, QCheckBox, QTableWidget, QTableWidgetItem,
            QHeaderView, QMenu, QDialog, QScrollArea, QTextEdit, QCompleter
        )
        from PyQt6.QtCore import Qt, QThread, QTimer, pyqtSignal
        from PyQt6.QtGui import QColor, QFont, QBrush, QPixmap, QIcon
        QT_BINDING = "PyQt6"
    except ImportError:
        from PyQt5 import QtWidgets, QtCore, QtGui
        from PyQt5.QtWidgets import (
            QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout, QPushButton,
            QLabel, QSplitter, QMessageBox, QProgressDialog, QFileDialog, QFrame,
            QLineEdit, QComboBox, QListWidget, QListWidgetItem, QGroupBox, QTreeWidget,
            QTreeWidgetItem, QAbstractItemView, QCheckBox, QTableWidget, QTableWidgetItem,
            QHeaderView, QMenu, QDialog, QScrollArea, QTextEdit, QCompleter
        )
        from PyQt5.QtCore import Qt, QThread, QTimer, pyqtSignal
        from PyQt5.QtGui import QColor, QFont, QBrush, QPixmap, QIcon
        QT_BINDING = "PyQt5"

# Standardized cross-version Qt Constants
if QT_BINDING in ("PySide6", "PyQt6"):
    ALIGN_CENTER = Qt.AlignmentFlag.AlignCenter
    ALIGN_LEFT = Qt.AlignmentFlag.AlignLeft
    ITEM_ENABLED = Qt.ItemFlag.ItemIsEnabled
    USER_ROLE = Qt.ItemDataRole.UserRole
    CHECKED = Qt.CheckState.Checked
    UNCHECKED = Qt.CheckState.Unchecked
    PARTIALLY_CHECKED = Qt.CheckState.PartiallyChecked
    WINDOW_MODAL = Qt.WindowModality.WindowModal
    NO_FOCUS = Qt.FocusPolicy.NoFocus
    RESIZE_STRETCH = QHeaderView.ResizeMode.Stretch
    RESIZE_FIXED = QHeaderView.ResizeMode.Fixed
    NO_EDIT_TRIGGERS = QTableWidget.EditTrigger.NoEditTriggers
    NO_SELECTION = QTableWidget.SelectionMode.NoSelection
    SINGLE_SELECTION = QAbstractItemView.SelectionMode.SingleSelection
    SHAPE_VLINE = QFrame.Shape.VLine
    HORIZONTAL = Qt.Orientation.Horizontal
    VERTICAL = Qt.Orientation.Vertical
    CUSTOM_CONTEXT_MENU = Qt.ContextMenuPolicy.CustomContextMenu
    POINTING_HAND_CURSOR = Qt.CursorShape.PointingHandCursor
    CASE_INSENSITIVE = Qt.CaseSensitivity.CaseInsensitive
    MATCH_CONTAINS = Qt.MatchFlag.MatchContains
else:
    ALIGN_CENTER = Qt.AlignCenter
    ALIGN_LEFT = Qt.AlignLeft
    ITEM_ENABLED = Qt.ItemIsEnabled
    USER_ROLE = Qt.UserRole
    CHECKED = Qt.Checked
    UNCHECKED = Qt.Unchecked
    PARTIALLY_CHECKED = 2
    WINDOW_MODAL = Qt.WindowModal
    NO_FOCUS = Qt.NoFocus
    RESIZE_STRETCH = QHeaderView.Stretch
    RESIZE_FIXED = QHeaderView.Fixed
    NO_EDIT_TRIGGERS = QTableWidget.EditTrigger.NoEditTriggers
    NO_SELECTION = QTableWidget.SelectionMode.NoSelection
    SINGLE_SELECTION = QAbstractItemView.SelectionMode.SingleSelection
    SHAPE_VLINE = QFrame.Shape.VLine
    HORIZONTAL = Qt.Horizontal
    VERTICAL = Qt.Vertical
    CUSTOM_CONTEXT_MENU = Qt.CustomContextMenu
    POINTING_HAND_CURSOR = Qt.PointingHandCursor
    CASE_INSENSITIVE = Qt.CaseInsensitive
    MATCH_CONTAINS = Qt.MatchContains
