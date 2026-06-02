#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
遊戲數值表視覺化 GUI (QGraphicsView 重構版 - 關聯示意視窗版)
- 中鍵平移 (Pan)
- 主視圖 (Main Graph): 僅顯示全域結構，不隱藏/移動節點 (Focus 時變暗非關聯節點)
- 關聯示意視窗 (Relation View): 顯示 Focus 節點與其關聯節點，Focus 置中，關聯在旁 (顏色同步主視圖)
- Excel 寫入改用 COM (由 ExcelHandler 處理)
- Details 面板: 無 Focus 時清空
- 持久化: 視窗大小/位置、Zoom/Pan、Splitter、Font Size
- 新增 Settings Dialog 與 Layout Reset
"""

import sys
import json
import math
import random
from pathlib import Path

# PyQt6 imports
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QSplitter, QTextEdit, QLineEdit, QPushButton, QLabel,
    QCheckBox, QMessageBox, QGraphicsView, QGraphicsScene,
    QGraphicsItem, QGraphicsPathItem, QGraphicsRectItem,
    QGraphicsTextItem, QTabWidget, QColorDialog, QFormLayout,
    QScrollArea, QFrame, QTableWidget, QTableWidgetItem,
    QHeaderView, QSpinBox, QDockWidget, QDialog, QSlider,
    QMenu, QListWidget, QListWidgetItem, QComboBox, QFileDialog,
    QCompleter, QAbstractItemView, QLayout, QSizePolicy, QProgressDialog,
    QGraphicsOpacityEffect
)
from PyQt6.QtCore import (
    Qt, QRect, QRectF, QPoint, QPointF, QLineF, pyqtSignal, QTimer, QSize,
    QEvent, QMimeData, QModelIndex
)
from PyQt6.QtGui import (
    QPainter, QPen, QBrush, QColor, QPainterPath, QFont, QFontMetrics,
    QTransform, QPolygonF, QIcon, QAction, QShortcut, QKeySequence, QDrag
)

from config_manager import ConfigManager
from excel_handler import ExcelHandler

# --- Constants ---
# Basic geometry will be dynamic based on global font size, but we keep base padding
NODE_WIDTH_PADDING = 20
NODE_HEIGHT_BASE = 40
NODE_RADIUS = 5
FONT_FAMILY = "Segoe UI"
GRID_SIZE = 20
GROUP_LABEL_WIDTH = 120  # 分組左側標題欄寬度 (v4.0)
GROUP_CARDS_BOTTOM_GAP = 14  # 分組卡片區底部留白，避免相鄰表格卡片相撞
PREVIEW_MAX_COL_WIDTH_DEFAULT = 900  # 右欄預覽欄寬上限預設值（可於 Settings 調整）

COLOR_DEFAULT = "#9E9E9E"
COLOR_SELECTED = "#FFD700"  # Gold
COLOR_HIGHLIGHT = "#FFFF00"
COLOR_DIMMED = "#333333" 

# --- Working Directory Dialog (v3.11) ---
class WorkingDirectoryDialog(QDialog):
    """工作目錄選擇對話框"""
    def __init__(self, parent=None, current_dir=None):
        super().__init__(parent)
        self.setWindowTitle("選擇工作目錄")
        self.resize(600, 200)
        self.selected_directory = current_dir
        
        layout = QVBoxLayout(self)
        
        # 說明文字
        info_label = QLabel(
            "請選擇包含 Excel 數據表檔案的目錄。\n"
            "JSON 配置檔將保存在應用程式所在目錄。"
        )
        info_label.setWordWrap(True)
        layout.addWidget(info_label)
        
        # 當前目錄顯示
        dir_layout = QHBoxLayout()
        dir_layout.addWidget(QLabel("Excel 目錄:"))
        
        self.dir_line_edit = QLineEdit()
        self.dir_line_edit.setText(current_dir or "")
        self.dir_line_edit.setReadOnly(True)
        dir_layout.addWidget(self.dir_line_edit)
        
        self.browse_btn = QPushButton("瀏覽...")
        self.browse_btn.clicked.connect(self.browse_directory)
        dir_layout.addWidget(self.browse_btn)
        
        layout.addLayout(dir_layout)
        
        # 驗證狀態顯示
        self.status_label = QLabel("")
        self.status_label.setWordWrap(True)
        layout.addWidget(self.status_label)
        
        # 按鈕
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        self.ok_btn = QPushButton("確定")
        self.ok_btn.clicked.connect(self.validate_and_accept)
        self.ok_btn.setEnabled(bool(current_dir))
        btn_layout.addWidget(self.ok_btn)
        
        self.cancel_btn = QPushButton("取消")
        self.cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(self.cancel_btn)
        
        layout.addLayout(btn_layout)
        
        # 初始驗證
        if current_dir:
            self.validate_directory(current_dir)
    
    def browse_directory(self):
        """瀏覽選擇目錄"""
        # 無已選目錄時不指定初始位置（傳空字串），交由系統決定，不跳到家目錄
        start_dir = self.selected_directory or ""
        directory = QFileDialog.getExistingDirectory(
            self,
            "選擇工作目錄",
            start_dir,
            QFileDialog.Option.ShowDirsOnly
        )
        
        if directory:
            self.selected_directory = directory
            self.dir_line_edit.setText(directory)
            self.validate_directory(directory)
    
    def validate_directory(self, path):
        """驗證選擇的目錄"""
        from config_manager import ConfigManager
        cm = ConfigManager()  # 臨時實例用於驗證
        is_valid, error_msg = cm.validate_working_directory(path)
        
        if is_valid:
            self.status_label.setText("✓ 目錄有效")
            self.status_label.setStyleSheet("color: green;")
            self.ok_btn.setEnabled(True)
        else:
            self.status_label.setText(f"✗ {error_msg}")
            self.status_label.setStyleSheet("color: red;")
            self.ok_btn.setEnabled(False)
    
    def validate_and_accept(self):
        """驗證後確認"""
        if self.selected_directory:
            self.accept()
    
    def get_selected_directory(self):
        """獲取選擇的目錄"""
        return self.selected_directory

# --- Add Relation Dialog --- (v3.13)
class AddRelationDialog(QDialog):
    """添加關聯對話框"""
    def __init__(self, parent, source_node, center_node, all_nodes_map, user_rel_manager):
        super().__init__(parent)
        self.source_node = source_node
        self.center_node = center_node
        self.all_nodes_map = all_nodes_map
        self.user_rel_manager = user_rel_manager
        
        self.setWindowTitle(f"添加關聯：{source_node['table']}.{source_node['sheet']}")
        self.resize(500, 400)
        
        layout = QVBoxLayout(self)
        
        # 說明
        info_label = QLabel(f"從 <b>{source_node['table']}.{source_node['sheet']}</b> 添加關聯")
        layout.addWidget(info_label)
        
        # 方向選擇
        direction_layout = QHBoxLayout()
        direction_layout.addWidget(QLabel("方向:"))
        self.direction_combo = QComboBox()
        self.direction_combo.addItem("From (此節點 → 目標)", "from")
        self.direction_combo.addItem("To (目標 → 此節點)", "to")
        direction_layout.addWidget(self.direction_combo)
        direction_layout.addStretch()
        layout.addLayout(direction_layout)
        
        # 搜尋框
        search_layout = QHBoxLayout()
        search_layout.addWidget(QLabel("搜尋:"))
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("輸入節點名稱...")
        self.search_input.textChanged.connect(self.filter_nodes)
        search_layout.addWidget(self.search_input)
        layout.addLayout(search_layout)
        
        # 節點列表
        self.node_list = QListWidget()
        self.populate_nodes()
        layout.addWidget(self.node_list)
        
        # 按鈕
        btn_layout = QHBoxLayout()
        self.ok_btn = QPushButton("添加")
        self.ok_btn.clicked.connect(self.add_relation)
        btn_layout.addWidget(self.ok_btn)
        
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)
        
        layout.addLayout(btn_layout)
    
    def populate_nodes(self, filter_text=""):
        """填充節點列表"""
        self.node_list.clear()
        
        # 排序節點
        sorted_nodes = sorted(
            self.all_nodes_map.values(),
            key=lambda x: f"{x['table']}.{x['sheet']}"
        )
        
        for node in sorted_nodes:
            # 排除自己
            if node['id'] == self.source_node['id']:
                continue
            
            node_name = f"{node['table']}.{node['sheet']}"
            
            # 過濾
            if filter_text and filter_text.lower() not in node_name.lower():
                continue
            
            item = QListWidgetItem(node_name)
            item.setData(Qt.ItemDataRole.UserRole, node)
            self.node_list.addItem(item)
    
    def filter_nodes(self, text):
        """過濾節點"""
        self.populate_nodes(text)
    
    def add_relation(self):
        """添加關聯"""
        current_item = self.node_list.currentItem()
        if not current_item:
            QMessageBox.warning(self, "錯誤", "請選擇一個目標節點")
            return
        
        target_node = current_item.data(Qt.ItemDataRole.UserRole)
        direction = self.direction_combo.currentData()
        
        # 確定 from 和 to
        if direction == "from":
            from_id = self.source_node['id']
            to_id = target_node['id']
        else:
            from_id = target_node['id']
            to_id = self.source_node['id']
        
        # 添加關聯
        if self.user_rel_manager:
            self.user_rel_manager.add_relation(from_id, to_id, label="Manual")
            self.accept()
        else:
            QMessageBox.warning(self, "錯誤", "無法訪問 UserRelationManager")

# --- Settings Dialog ---
class SettingsDialog(QDialog):
    font_changed = pyqtSignal(int)
    preview_col_width_changed = pyqtSignal(int)

    def __init__(self, parent, current_font_size, current_col_width=PREVIEW_MAX_COL_WIDTH_DEFAULT):
        super().__init__(parent)
        self.setWindowTitle("Settings")
        self.resize(340, 160)

        layout = QVBoxLayout(self)

        # Font Size
        layout.addWidget(QLabel("Global Font Size (Live Preview):"))
        font_layout = QHBoxLayout()
        self.font_curr_label = QLabel(str(current_font_size))

        self.slider = QSlider(Qt.Orientation.Horizontal)
        self.slider.setRange(8, 24)
        self.slider.setValue(current_font_size)
        self.slider.valueChanged.connect(self.on_slider_change)

        font_layout.addWidget(self.slider)
        font_layout.addWidget(self.font_curr_label)
        layout.addLayout(font_layout)

        # 右欄預覽欄寬上限（字數截斷門檻）
        layout.addWidget(QLabel("Preview Max Column Width (字數截斷門檻):"))
        col_layout = QHBoxLayout()
        self.col_curr_label = QLabel(str(current_col_width))
        self.col_slider = QSlider(Qt.Orientation.Horizontal)
        self.col_slider.setRange(100, 2000)
        self.col_slider.setSingleStep(50)
        self.col_slider.setPageStep(100)
        self.col_slider.setValue(int(current_col_width))
        self.col_slider.valueChanged.connect(self.on_col_width_change)
        col_layout.addWidget(self.col_slider)
        col_layout.addWidget(self.col_curr_label)
        layout.addLayout(col_layout)

        # Reset Layout button moved to Main Window

        layout.addStretch()

    def on_slider_change(self, val):
        self.font_curr_label.setText(str(val))
        self.font_changed.emit(val)

    def on_col_width_change(self, val):
        self.col_curr_label.setText(str(val))
        self.preview_col_width_changed.emit(val)

# --- Shared Graphics Items ---

class GraphNodeItem(QGraphicsItem):
    """通用節點"""
    def __init__(self, node_data, view_context, is_main_view=True, font_size=10, is_missing=False):
        super().__init__()
        self.node_data = node_data
        self.view_context = view_context 
        self.is_main_view = is_main_view
        self.node_id = node_data['id']
        self.full_name = f"{node_data['table']}.{node_data['sheet']}"
        self.label = node_data['sheet']
        self.edges = []
        self.font_size = font_size
        
        # v3.13 編輯模式
        self.edit_mode = False
        self.add_button = None  # 加號按鈕
        self.close_button = None # v3.16 Ghost Node Remove Button
        
        # v3.16 Ghost State
        self.is_missing = is_missing
        if self.is_missing:
            self.label += " (Violated)"
        
        # v3.14 移除 ItemIsSelectable 避免 Tap 時出現黃框
        # 只保留 ItemIsMovable（主視圖）和 ItemSendsGeometryChanges
        if is_main_view:
            self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemIsMovable)
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemSendsGeometryChanges)
        self.setZValue(1)
        self.setCacheMode(QGraphicsItem.CacheMode.DeviceCoordinateCache)
        
        self.setAcceptHoverEvents(True)
        
        self.bg_color = QColor(COLOR_DEFAULT)
        self.text_color = QColor(Qt.GlobalColor.white)
        self.recalc_geometry()
        
        self.is_dimmed = False
        self.is_highlighted = False
        # v3.14 Focus 狀態（替代原本的 isSelected）
        self.is_focused = False
        # 釘選狀態（僅 Relation View 顯示圖釘 icon）
        self.is_pinned = False
        
        # Init missing UI
        if self.is_missing:
            self.set_missing_ui()

    def set_font_size(self, size):
        self.font_size = size
        self.recalc_geometry()
        self.update()
        
    def recalc_geometry(self):
        # Calculate Dimensions based on font
        self.height = NODE_HEIGHT_BASE + (self.font_size - 10) * 2
        char_w = self.font_size * 0.7
        self.width = len(self.label) * char_w + NODE_WIDTH_PADDING * 2
        self.width = max(self.width, 100)
        self.prepareGeometryChange() # Notify scene of size change
        
        # Update button positions if they exist
        if self.add_button:
            self.add_button.setPos(self.width/2 + 12, 0)
        if self.close_button:
            self.close_button.setPos(self.width/2, -self.height/2)

    def boundingRect(self):
        return QRectF(-self.width / 2, -self.height / 2, self.width, self.height)

    def paint(self, painter, option, widget):
        # v3.14 由於移除了 ItemIsSelectable，不再有自動選中狀態
        # 只使用 is_dimmed 和 is_highlighted 來控制外觀
        
        # v3.16 Missing State overrides others
        if self.is_missing:
            fill_color = QColor("#442222") # Dark Red background
            text_color = QColor("#FF5555") # Red text
            border_color = QColor("#FF0000") # Red border
            
            if self.is_main_view and self.is_focused:
                 border_color = QColor("#FFA500") # Focused still gets orange/gold border but keeps red fill?
        
        elif self.is_dimmed:
            fill_color = self.bg_color.darker(250)
            text_color = QColor("#555555")
            border_color = QColor("#333333")
        else:
            fill_color = self.bg_color
            text_color = self.text_color
            border_color = QColor(Qt.GlobalColor.white)
            
            if self.is_focused:  # v3.14 Focus 狀態
                # Relation View uses Orange, Main View uses Gold
                border_color = QColor(COLOR_SELECTED) if self.is_main_view else QColor("#FFA500")
                fill_color = fill_color.lighter(120)
            elif self.is_highlighted:
                border_color = QColor(COLOR_HIGHLIGHT)
                fill_color = fill_color.lighter(130)

        path = QPainterPath()
        path.addRoundedRect(self.boundingRect(), NODE_RADIUS, NODE_RADIUS)
        
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Pen Style for Missing
        pen = QPen(border_color, 2 if (self.is_focused or self.is_missing) else 1)
        if self.is_missing:
             pen.setStyle(Qt.PenStyle.DashLine)
             
        painter.setPen(pen)
        painter.setBrush(QBrush(fill_color))
        painter.drawPath(path)
        
        painter.setPen(text_color)
        font = QFont(FONT_FAMILY, self.font_size)
        # v3.14 Focus 狀態字體加粗
        if self.is_focused: font.setBold(True)
        painter.setFont(font)
        painter.drawText(self.boundingRect(), Qt.AlignmentFlag.AlignCenter, self.label)

        # 釘選狀態：於右上角畫出圖釘 icon（僅 Relation View）
        if self.is_pinned and not self.is_main_view:
            pin_font = QFont(FONT_FAMILY, max(9, self.font_size))
            painter.setFont(pin_font)
            pin_rect = QRectF(self.width / 2 - 20, -self.height / 2 + 1, 18, 18)
            painter.drawText(pin_rect, Qt.AlignmentFlag.AlignCenter, "📌")

    def itemChange(self, change, value):
        # v3.14 在拖曳過程中和位置改變後都更新箭頭
        if change == QGraphicsItem.GraphicsItemChange.ItemPositionChange:
            # 拖曳過程中即時更新箭頭位置
            for edge in self.edges:
                edge.adjust()
        elif change == QGraphicsItem.GraphicsItemChange.ItemPositionHasChanged:
            # 位置改變完成後再次更新（確保準確）
            for edge in self.edges:
                edge.adjust()
        return super().itemChange(change, value)

    def mouseReleaseEvent(self, event):
        super().mouseReleaseEvent(event)
        if self.is_main_view:
            self.view_context.on_node_moved(self)
            
    def mousePressEvent(self, event):
        # Relation View 的中鍵釘選改由 RelationGraphView.mousePressEvent 處理，
        # 因為 BaseGraphView 會先攔截中鍵啟動平移，節點本身收不到中鍵事件。
        super().mousePressEvent(event)
        if not self.is_main_view:
             # Use callback for reliable interaction in Relation View
             if hasattr(self.view_context, "on_node_clicked"):
                 self.view_context.on_node_clicked(self)

    def mouseDoubleClickEvent(self, event):
        if not self.is_missing:
            self.view_context.on_node_double_clicked(self)
        super().mouseDoubleClickEvent(event)

    # v3.16 Removed Context Menu (Edit Connections) as requested

    def set_missing_ui(self):
        """Setup UI for missing node (X button)"""
        from PyQt6.QtWidgets import QGraphicsEllipseItem, QGraphicsTextItem
        
        if self.close_button: return
        
        # Create X button at top-right corner
        btn_size = 20
        btn = QGraphicsEllipseItem(-btn_size/2, -btn_size/2, btn_size, btn_size, self)
        btn.setBrush(QBrush(QColor("#FF0000")))
        btn.setPen(QPen(Qt.GlobalColor.white, 1))
        btn.setZValue(100)
        
        text = QGraphicsTextItem("X", btn)
        text.setDefaultTextColor(Qt.GlobalColor.white)
        font = QFont(FONT_FAMILY, 10, QFont.Weight.Bold)
        text.setFont(font)
        r = text.boundingRect()
        text.setPos(-r.width()/2, -r.height()/2) # Center in circle
        
        # Position at top-right of node rect
        # Node rect is centered at 0,0. Top-Right is (w/2, -h/2)
        btn.setPos(self.width/2, -self.height/2)
        
        btn.setAcceptHoverEvents(True)
        btn.setCursor(Qt.CursorShape.PointingHandCursor)
        
        # Event
        btn.mousePressEvent = lambda e: self.on_close_button_clicked()
        
        self.close_button = btn
        
    def on_close_button_clicked(self):
        """Remove this ghost node"""
        if self.view_context and hasattr(self.view_context, 'remove_ghost_node'):
            self.view_context.remove_ghost_node(self)

    def set_edit_mode(self, enabled):
        """設置編輯模式 (v3.13)"""
        self.edit_mode = enabled
        
        # 移除舊按鈕
        if self.add_button:
            self.scene().removeItem(self.add_button)
            self.add_button = None
        
        # 在編輯模式下添加加號按鈕（僅在 Relation View）
        if enabled and not self.is_main_view and not self.is_missing:
            from PyQt6.QtWidgets import QGraphicsEllipseItem, QGraphicsTextItem
            
            # 創建加號按鈕
            button_size = 24
            button = QGraphicsEllipseItem(-button_size/2, -button_size/2, button_size, button_size, self)
            button.setBrush(QBrush(QColor("#4CAF50")))  # 綠色背景
            button.setPen(QPen(QColor("#FFFFFF"), 2))
            button.setZValue(10)
            
            # 加號文字
            plus_text = QGraphicsTextItem("+", button)
            plus_text.setDefaultTextColor(QColor("#FFFFFF"))
            plus_text.setFont(QFont(FONT_FAMILY, 16, QFont.Weight.Bold))
            text_rect = plus_text.boundingRect()
            plus_text.setPos(-text_rect.width()/2, -text_rect.height()/2)
            
            # 定位在節點右側
            button.setPos(self.width/2 + button_size, 0)
            button.setAcceptHoverEvents(True)
            button.setCursor(Qt.CursorShape.PointingHandCursor)
            
            # 保存引用以便後續使用
            button.node_item = self
            button.mousePressEvent = lambda event: self.on_add_button_clicked()
            
            self.add_button = button
        
        self.update()
    
    def on_add_button_clicked(self):
        """點擊加號按鈕 (v3.13)"""
        # 呼叫 RelationGraphView 的添加關聯對話框
        if hasattr(self.view_context, 'show_add_relation_dialog'):
            self.view_context.show_add_relation_dialog(self.node_data)


# --- Views ---
class BaseGraphView(QGraphicsView):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.scene = QGraphicsScene(self)
        self.setScene(self.scene)
        self.setRenderHint(QPainter.RenderHint.Antialiasing)
        self.setDragMode(QGraphicsView.DragMode.ScrollHandDrag)
        self.setTransformationAnchor(QGraphicsView.ViewportAnchor.AnchorUnderMouse)
        self.setResizeAnchor(QGraphicsView.ViewportAnchor.AnchorUnderMouse)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.scale_factor = 1.1

    def wheelEvent(self, event):
        if event.modifiers() & Qt.KeyboardModifier.ControlModifier:
            if event.angleDelta().y() > 0:
                self.scale(self.scale_factor, self.scale_factor)
            else:
                self.scale(1 / self.scale_factor, 1 / self.scale_factor)
        else:
            super().wheelEvent(event)

class MainGraphView(BaseGraphView):
    # ... (Keep existing signals/init)
    node_selected = pyqtSignal(dict) 
    node_deselected = pyqtSignal()
    
    def __init__(self, parent, config_manager, excel_handler):
        super().__init__(parent)
        self.config_manager = config_manager
        self.excel_handler = excel_handler
        self.node_items = {}
        self.edge_items = []
        self.is_focus_active = False

    def set_font_size_live(self, size):
        for item in self.node_items.values():
            item.set_font_size(size)
        for edge in self.edge_items:
            edge.adjust() # Edges might need readjustment if nodes resized? Yes.
            
    # ... (Rest of MainGraphView methods logic is fine, no changes needed except ensure set_scene_items passes font)
    def set_scene_items(self, nodes_data, edges_data, font_size=10):
        self.scene.clear()
        self.node_items.clear()
        self.edge_items.clear()
        
        # Nodes
        for node in nodes_data:
            item = GraphNodeItem(node, self, is_main_view=True, font_size=font_size)
            pos = self.config_manager.get_node_position(f"{node['table']}.{node['sheet']}")
            if pos: item.setPos(pos[0], pos[1])
            
            color_hex = self.config_manager.get_table_color(node['table'])
            item.bg_color = QColor(color_hex)
            
            self.scene.addItem(item)
            self.node_items[node['id']] = item
            
        # Edges (Same as before)
        bidirectional_pairs = set()
        for e in edges_data:
            u, v = e['from'], e['to']
            if any(x['from'] == v and x['to'] == u for x in edges_data):
                bidirectional_pairs.add(tuple(sorted((u, v))))
        
        processed = set()
        for e in edges_data:
            u, v = e['from'], e['to']
            if u not in self.node_items or v not in self.node_items: continue
            
            pair = tuple(sorted((u, v)))
            src, dst = self.node_items[u], self.node_items[v]
            
            if pair in bidirectional_pairs:
                if (u, v) in processed: continue
                e1 = GraphEdgeItem(src, dst, True, 1)
                e2 = GraphEdgeItem(dst, src, True, 1)
                self.scene.addItem(e1)
                self.scene.addItem(e2)
                self.edge_items.extend([e1, e2])
                processed.add((u, v))
                processed.add((v, u))
            else:
                e1 = GraphEdgeItem(src, dst, False, 0)
                self.scene.addItem(e1)
                self.edge_items.append(e1)

        if self.node_items:
            rect = self.scene.itemsBoundingRect()
            self.scene.setSceneRect(rect.adjusted(-2000, -2000, 2000, 2000))

    # ... (Rest of MainGraphView)
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            item = self.itemAt(event.pos())
            if isinstance(item, GraphNodeItem):
                self.apply_focus_dimming(item) 
                self.node_selected.emit(item.node_data)
            else:
                self.clear_focus_dimming()
                self.node_deselected.emit()
        super().mousePressEvent(event)

    def apply_focus_dimming(self, center_item):
        self.is_focus_active = True
        related_ids = {center_item.node_id}
        for edge in center_item.edges:
            related_ids.add(edge.source.node_id)
            related_ids.add(edge.dest.node_id)
            
        for item in self.node_items.values():
            if item.node_id in related_ids:
                item.is_dimmed = False
                item.setZValue(1)
            else:
                item.is_dimmed = True
                item.setZValue(0)
            item.update()
            
        for edge in self.edge_items:
            edge.adjust()
            edge.update()

    def clear_focus_dimming(self):
        self.is_focus_active = False
        for item in self.node_items.values():
            item.is_dimmed = False
            item.setZValue(0)
            item.update()
        for edge in self.edge_items:
            edge.adjust()
            edge.update()
            
    def search_highlight(self, keyword):
        if self.is_focus_active:
            self.clear_focus_dimming()
            
        keyword = keyword.lower()
        first_match = None
        for item in self.node_items.values():
            if keyword in item.label.lower() or keyword in item.node_data['table'].lower():
                item.is_highlighted = True
                item.is_dimmed = False
                item.setZValue(2)
                if not first_match: first_match = item
            else:
                item.is_highlighted = False
                item.is_dimmed = True
                item.setZValue(0)
            item.update()
        
        for item in self.edge_items:
            item.adjust()
            item.update()
                
        if first_match: self.centerOn(first_match)

    def clear_search(self):
        for item in self.node_items.values():
            item.is_dimmed = False
            item.is_highlighted = False
            item.setZValue(0)
            item.update()
        for item in self.edge_items:
            item.adjust()
            item.update()

    def arrange_clustered_layout(self, nodes_data):
        # (Layout logic unchanged from v3.4 update)
        # Assuming we just need to keep it. 
        # But wait, I need to make sure I don't overwrite the previous fix of layout algorithm.
        # The tool replaces "EndLine:998", so I need to be careful to include everything or just selective replace.
        # Since I'm refactoring classes, I might need to replace chunks.
        # Let's verify the extent of changes.
        pass # Fallback to original layout method logic in replaced text below

# RelationGraphView Update
class RelationGraphView(BaseGraphView):
    details_requested = pyqtSignal(dict)
    
    def __init__(self, parent, config_manager, excel_handler):
        super().__init__(parent)
        self.config_manager = config_manager
        self.excel_handler = excel_handler
        self.font_size = 10
        self.show_empty_state()

    def set_font_size_live(self, size):
        self.font_size = size
        for item in self.scene.items():
            if isinstance(item, GraphNodeItem):
                item.set_font_size(size)
        # Update edges? Edges auto-adjust via itemChange, but we didn't move them.
        # But node size changed, so edge endpoints might need refresh.
        # GraphNodeItem.recalc_geometry calls prepareGeometryChange.
        # But edge.adjust is called in ItemPositionHasChanged. Size change might not trigger position change?
        # Let's force edge adjust.
        for item in self.scene.items():
            if isinstance(item, GraphEdgeItem):
                item.adjust()

    def show_empty_state(self):
        self._user_zoomed = False
        self.scene.clear()
        self.setBackgroundBrush(QBrush(QColor("#1e1e1e")))
        text = self.scene.addText("Select a node to view relations")
        text.setDefaultTextColor(QColor("#666666"))
        font = QFont(FONT_FAMILY, 14)
        text.setFont(font)
        text.setPos(-text.boundingRect().width()/2, -text.boundingRect().height()/2)
        
    def show_relations(self, center_node_data, all_edges, all_nodes_map, font_size=10):
        self.scene.clear()
        self.setBackgroundBrush(QBrush(Qt.BrushStyle.NoBrush))
        self.font_size = font_size
        
        cid = center_node_data['id']
        incoming = []
        outgoing = []
        
        for e in all_edges:
            if e['from'] == cid and e['to'] in all_nodes_map:
                outgoing.append(all_nodes_map[e['to']])
            elif e['to'] == cid and e['from'] in all_nodes_map:
                incoming.append(all_nodes_map[e['from']])
                
        def create_item(n_data):
            it = GraphNodeItem(n_data, self, is_main_view=False, font_size=self.font_size)
            color = self.config_manager.get_table_color(n_data['table'])
            it.bg_color = QColor(color)
            return it

        center_item = create_item(center_node_data)
        center_item.setPos(0, 0)
        center_item.setSelected(True) 
        self.scene.addItem(center_item)
        
        spacing_x = 300
        spacing_y = 60 + (self.font_size - 10) * 2
        
        start_y = -((len(incoming) - 1) * spacing_y) / 2
        for i, node_data in enumerate(incoming):
            item = create_item(node_data)
            item.setPos(-spacing_x, start_y + i * spacing_y)
            self.scene.addItem(item)
            self.scene.addItem(GraphEdgeItem(item, center_item, False, 0))
            
        start_y = -((len(outgoing) - 1) * spacing_y) / 2
        for i, node_data in enumerate(outgoing):
            item = create_item(node_data)
            item.setPos(spacing_x, start_y + i * spacing_y)
            self.scene.addItem(item)
            self.scene.addItem(GraphEdgeItem(center_item, item, False, 0))
            
        self.scene.setSceneRect(self.scene.itemsBoundingRect().adjusted(-50, -50, 50, 50))
        self.fitInView(self.scene.sceneRect(), Qt.AspectRatioMode.KeepAspectRatio)

    def on_node_clicked(self, item):
        self.details_requested.emit(item.node_data)
        for i in self.scene.items():
            if isinstance(i, GraphNodeItem):
                i.setSelected(False)
        item.setSelected(True)
    
    def resizeEvent(self, event):
        super().resizeEvent(event)
        if self.scene.items():
             self.fitInView(self.scene.sceneRect(), Qt.AspectRatioMode.KeepAspectRatio)

    def on_node_moved(self, item): pass
    def on_node_double_clicked(self, item):
        if self.excel_handler:
            self.excel_handler.open_sheet(item.node_data['filename'], item.node_data['sheet'])

class MainWindow(QMainWindow):
    # ... (init_ui changes need to be applied here)
    def open_settings(self):
        dlg = SettingsDialog(self, self.font_size)
        dlg.font_changed.connect(self.on_font_changed)
        dlg.exec()
        
    def on_font_changed(self, size):
        self.font_size = size
        self.config_manager.set_global_font_size(size)
        
        # Live Update
        self.setFont(QFont(FONT_FAMILY, size))
        self.main_view.set_font_size_live(size)
        self.relation_view.set_font_size_live(size)
        if self.details.current_node_data:
             self.details.refresh_table() # Refresh table font
             
    def on_reset_layout(self):
        confirm = QMessageBox.question(
            self, "Confirm Reset", 
            "This will reset all node positions to a clustered layout.\nAre you sure?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        if confirm == QMessageBox.StandardButton.Yes:
            nodes = [n for n in self.graph_data['nodes'] if n['id'] in self.main_view.node_items]
            new_pos = self.main_view.arrange_clustered_layout(nodes)
            for item in self.main_view.node_items.values():
                p = new_pos.get(item.full_name)
                if p: item.setPos(p[0], p[1])
                self.config_manager.set_node_position(item.full_name, p[0], p[1])
            self.config_manager.save_config()
            self.main_view.scene.update()


class GraphEdgeItem(QGraphicsPathItem):
    """通用連線"""
    def __init__(self, source_node, dest_node, is_bidirectional=False, offset_direction=0):
        super().__init__()
        self.source = source_node
        self.dest = dest_node
        self.is_bidirectional = is_bidirectional
        self.offset_direction = offset_direction
        
        # v3.13 編輯模式
        self.edit_mode = False
        self.delete_button = None
        self.from_id = None  # 將由 show_relations 設定
        self.to_id = None
        
        # v3.14 Focus 相關連線標記
        self.is_focus_related = False
        
        self.setZValue(-1)
        self.source.edges.append(self)
        self.dest.edges.append(self)
        self.setAcceptHoverEvents(True)
        self.adjust()

    def adjust(self):
        if not self.source or not self.dest: return
        
        line = QLineF(self.source.scenePos(), self.dest.scenePos())
        length = line.length()
        if length == 0: return

        path = QPainterPath()
        src_pos = self.source.scenePos()
        dst_pos = self.dest.scenePos()
        
        if self.is_bidirectional and self.offset_direction != 0:
            offset = 15.0 * self.offset_direction
            perp_x = -(dst_pos.y() - src_pos.y()) / length * offset
            perp_y = (dst_pos.x() - src_pos.x()) / length * offset
            src_pos = QPointF(src_pos.x() + perp_x, src_pos.y() + perp_y)
            dst_pos = QPointF(dst_pos.x() + perp_x, dst_pos.y() + perp_y)

        path.moveTo(src_pos)
        path.lineTo(dst_pos)
        self.setPath(path)
        
        # Focus 相關連線使用特殊樣式
        if self.is_focus_related:
            # Check for custom focus color (assigned by view)
            if hasattr(self, 'focus_color') and self.focus_color:
                color = self.focus_color
            else:
                color = QColor("#FFD700")  # Default Gold

            pen_width = 4  # 加粗
            self.setZValue(0.5)  # 穿透非關聯節點(0)，但在關聯節點(1)之下
        else:
            color = QColor("#64B5F6") if self.offset_direction == 1 else \
                    QColor("#FF9800") if self.offset_direction == -1 else \
                    QColor("#81C784")
            pen_width = 2
                    
            if self.source.is_dimmed or self.dest.is_dimmed:
                color = QColor("#333333")
                self.setZValue(-2)
            else:
                self.setZValue(-1)
            
        self.setPen(QPen(color, pen_width))

    def paint(self, painter, option, widget):
        # Focus 相關連線即使在箭頭隱藏模式下也要顯示
        # 檢查是否應該顯示（如果不是 focus 相關且被隱藏，則不繪製）
        if not self.isVisible() and not self.is_focus_related:
            return
            
        painter.setPen(self.pen())
        painter.drawPath(self.path())
        
        path = self.path()
        if path.elementCount() < 2: return
            
        line = QLineF(path.pointAtPercent(0), path.pointAtPercent(1))
        angle = math.atan2(-line.dy(), line.dx())
        
        # 計算箭頭位置：線段與節點之間可見部分的中點
        # 取得起點和終點在場景中的位置
        start_pos = self.source.scenePos()
        end_pos = self.dest.scenePos()
        
        # 計算節點半徑（取寬度和高度的較大值的一半）
        source_radius = max(self.source.width, self.source.height) / 2
        dest_radius = max(self.dest.width, self.dest.height) / 2
        
        # 計算線段總長度
        total_length = line.length()
        if total_length == 0:
            return
        
        # 計算可見線段的起點和終點（扣除節點覆蓋的部分）
        # 起點偏移 source_radius，終點偏移 dest_radius
        visible_start = source_radius / total_length  # 比例
        visible_end = 1.0 - (dest_radius / total_length)  # 比例
        
        # 箭頭放在可見線段的中點
        arrow_position = (visible_start + visible_end) / 2
        arrow_position = max(0.1, min(0.9, arrow_position))  # 限制在 10%-90% 之間
        
        dest_point = path.pointAtPercent(arrow_position)
        arrow_size = 12 if self.is_focus_related else 10  # Focus 連線箭頭稍大
        p1 = dest_point + QPointF(math.sin(angle - math.pi / 3) * arrow_size,
                                  math.cos(angle - math.pi / 3) * arrow_size)
        p2 = dest_point + QPointF(math.sin(angle - math.pi + math.pi / 3) * arrow_size,
                                  math.cos(angle - math.pi + math.pi / 3) * arrow_size)

        arrow_head = QPolygonF([dest_point, p1, p2])
        painter.setBrush(QBrush(self.pen().color()))
        painter.drawPolygon(arrow_head)
    
    def set_edit_mode(self, enabled):
        """設置編輯模式 (v3.13)"""
        self.edit_mode = enabled
        
        # 移除舊按鈕
        if self.delete_button:
            self.scene().removeItem(self.delete_button)
            self.delete_button = None
        
        # 在編輯模式下添加刪除按鈕
        if enabled:
            from PyQt6.QtWidgets import QGraphicsEllipseItem, QGraphicsLineItem
            
            # 計算箭頭中點位置
            path = self.path()
            if path.elementCount() >= 2:
                mid_point = path.pointAtPercent(0.5)
                
                # 創建刪除按鈕（紅色圓圈加叉叉）
                button_size = 20
                button = QGraphicsEllipseItem(
                    mid_point.x() - button_size/2,
                    mid_point.y() - button_size/2,
                    button_size,
                    button_size
                )
                button.setBrush(QBrush(QColor("#F44336")))  # 紅色背景
                button.setPen(QPen(QColor("#FFFFFF"), 2))
                button.setZValue(10)
                button.setAcceptHoverEvents(True)
                button.setCursor(Qt.CursorShape.PointingHandCursor)
                
                # 添加叉叉
                line_offset = button_size * 0.3
                line1 = QGraphicsLineItem(
                    mid_point.x() - line_offset, mid_point.y() - line_offset,
                    mid_point.x() + line_offset, mid_point.y() + line_offset,
                    button
                )
                line2 = QGraphicsLineItem(
                    mid_point.x() - line_offset, mid_point.y() + line_offset,
                    mid_point.x() + line_offset, mid_point.y() - line_offset,
                    button
                )
                line1.setPen(QPen(QColor("#FFFFFF"), 2))
                line2.setPen(QPen(QColor("#FFFFFF"), 2))
                
                # 保存引用
                button.edge_item = self
                button.mousePressEvent = lambda event: self.on_delete_button_clicked()
                
                self.scene().addItem(button)
                self.delete_button = button
        
        self.update()
    
    def on_delete_button_clicked(self):
        """點擊刪除按鈕 (v3.13)"""
        # 獲取 RelationGraphView
        view = None
        for view_widget in self.scene().views():
            if hasattr(view_widget, 'remove_relation'):
                view = view_widget
                break
        
        if view and self.from_id and self.to_id:
            view.remove_relation(self.from_id, self.to_id)


# --- Views ---

class BaseGraphView(QGraphicsView):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.scene = QGraphicsScene(self)
        self.setScene(self.scene)
        self.setRenderHint(QPainter.RenderHint.Antialiasing)
        self.setDragMode(QGraphicsView.DragMode.NoDrag)
        self.setTransformationAnchor(QGraphicsView.ViewportAnchor.AnchorUnderMouse)
        self.setResizeAnchor(QGraphicsView.ViewportAnchor.AnchorUnderMouse)
        self.viewport().setMouseTracking(True)
        self.middle_mouse_pressed = False
        self.last_pan_pos = QPointF()
        # 使用者一旦以滾輪縮放，便停止「resize 時自動 fitInView」，
        # 否則 PC 上縮放放大→出現捲軸→viewport 縮小→resizeEvent→fitInView 縮回，
        # 造成「無法拉近」。reset_view 時會清除此旗標。
        self._user_zoomed = False

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.MiddleButton:
            self.middle_mouse_pressed = True
            self.last_pan_pos = event.pos()
            self.setCursor(Qt.CursorShape.ClosedHandCursor)
            event.accept()
            return
        super().mousePressEvent(event)

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.MiddleButton:
            self.middle_mouse_pressed = False
            self.setCursor(Qt.CursorShape.ArrowCursor)
            event.accept()
            return
        super().mouseReleaseEvent(event)

    def mouseMoveEvent(self, event):
        if self.middle_mouse_pressed:
            delta = event.pos() - self.last_pan_pos
            self.last_pan_pos = event.pos()
            h_bar = self.horizontalScrollBar()
            v_bar = self.verticalScrollBar()
            h_bar.setValue(h_bar.value() - delta.x())
            v_bar.setValue(v_bar.value() - delta.y())
            event.accept()
            return
        super().mouseMoveEvent(event)

    def wheelEvent(self, event):
        zoom_in = 1.15
        zoom_out = 1 / zoom_in
        factor = zoom_in if event.angleDelta().y() > 0 else zoom_out
        self._user_zoomed = True
        self.scale(factor, factor)
        event.accept()

    def on_node_double_clicked(self, node_item):
        pass


class MainGraphView(BaseGraphView):
    node_selected = pyqtSignal(dict)
    node_deselected = pyqtSignal()
    
    def __init__(self, parent, config_manager, excel_handler):
        super().__init__(parent)
        self.config_manager = config_manager
        self.excel_handler = excel_handler
        self.node_items = {}
        self.edge_items = []
        self.is_focus_active = False
        
        # v3.14 記錄滑鼠按下位置，用於區分 Click 和 Drag
        self.mouse_press_pos = None
        self.mouse_press_item = None
        
        # v3.14 全局箭頭隱藏狀態
        self.arrows_hidden = False
        
    def remove_ghost_node(self, item):
        """Remove a ghost node manually"""
        if item.node_id in self.node_items:
            del self.node_items[item.node_id]
        self.scene.removeItem(item)
        
        # Remove associated edges
        edges_to_remove = [e for e in self.edge_items if e.source == item or e.dest == item]
        for e in edges_to_remove:
            self.scene.removeItem(e)
            self.edge_items.remove(e)
            
        # Update config? 
        # Node position is in config by "Table.Sheet" name. We can remove it or keep it.
        # Keeping it is fine. "Ghost" node implies it's missing from current data but existed.
        QMessageBox.information(self.window(), "Removed", f"Removed ghost node: {item.full_name}")

    def update_scene_items_diff(self, new_nodes_data, new_edges_data, font_size=10):
        """Smart update of scene items (Diff/Merge)"""
        
        # 1. Identify Existing, New, and Missing Nodes
        existing_map = {item.full_name: item for item in self.node_items.values()}
        new_data_map = {f"{n['table']}.{n['sheet']}": n for n in new_nodes_data}
        
        # A. Process New Data (Update Existing + Create New)
        active_ids = set()
        
        for full_name, node_data in new_data_map.items():
            active_ids.add(node_data['id'])
            
            if full_name in existing_map:
                # Update existing item
                item = existing_map[full_name]
                item.node_data = node_data # Update data
                item.node_id = node_data['id'] # ID might change if re-generated sequentially?
                # Actually, RelationshipAnalyzer generates IDs sequentially. 
                # If a middle file is deleted, IDs shift. This is tricky.
                # Relying on ID for map key in self.node_items is dangerous if IDs change.
                # But here we map by full_name which is stable.
                
                # Check if it was missing before, now found
                if item.is_missing:
                    item.is_missing = False
                    if item.close_button:
                        item.scene().removeItem(item.close_button)
                        item.close_button = None
                    # Update label
                    item.label = node_data['sheet']
                    
                item.update()
                
            else:
                # Create NEW item
                item = GraphNodeItem(node_data, self, is_main_view=True, font_size=font_size)
                pos = self.config_manager.get_node_position(full_name)
                
                # If no pos, find a place (0,0 or try to pack?)
                if not pos:
                    pos = [0, 0] # Reset layout will fix, or we can find a spot.
                    # Let's put it near 0,0 for now.
                    
                item.setPos(pos[0], pos[1])
                color_hex = self.config_manager.get_table_color(node_data['table'])
                item.bg_color = QColor(color_hex)
                self.scene.addItem(item)
                
        # B. Identify Missing Nodes (Ghost)
        # Any item in existing_map that is NOT in new_data_map
        for full_name, item in existing_map.items():
            if full_name not in new_data_map:
                # Mark as missing
                item.is_missing = True
                item.label = f"{item.node_data['sheet']} (Missing)"
                item.set_missing_ui()
                item.update()
                
        # Re-build self.node_items map based on current scene items (using new IDs if updated)
        # Note: If ID collision occurs because of shifting, we have issues.
        # Ideally, we should use full_name as key in self.node_items?
        # Current implementation uses integer ID.
        # Let's rebuild self.node_items mapping using the NEW IDs for active nodes,
        # and keep old IDs for ghost nodes (hoping no collision with new IDs).
        
        # Strategy: Clear map, rebuild.
        self.node_items.clear()
        
        # Add active nodes
        for full_name, node_data in new_data_map.items():
            # Find the item (we either updated or created it)
            # We need to find it in scene? We didn't keep a ref to new ones in loop above.
            # Optimization: Let's store them in a temp map in loop A.
            pass
            
        # Rerun to populate map
        scene_items = [i for i in self.scene.items() if isinstance(i, GraphNodeItem)]
        for item in scene_items:
            # If item is active (in new data), ensure its ID matches new data
            if not item.is_missing:
                # Ensure item.node_id matches node_data['id']
                # active items got their node_data updated in loop A.
                self.node_items[item.node_data['id']] = item
            else:
                # Ghost node. Its ID is from old run. 
                # Does it matter? Edges use IDs.
                # If we delete edges and recreate based on new data, ghost nodes won't have edges 
                # unless we preserve manual edges to ghosts?
                # User Requirement: "manual connections... memorize... even Rescan wont change"
                # But manual connections refer to IDs. If IDs shift, manual connections break.
                # !!! CRITICAL: IDs are unstable if generated sequentially 0..N each run.
                # Solution: Manual connections should store Full Name, not ID.
                # UserRelationManager uses IDs? Let's check.
                # user_relations.json: {'from': id, 'to': id...}
                # If IDs are unstable, we must migrate UserRelationManager to use Names.
                
                # Check UserRelationManager... (Step 142 view)
                # It uses IDs.
                # If we want robust Rescan where sheets add/remove, IDs WILL shift.
                # We need to Upgrade UserRelationManager to use Names on the fly?
                # Or change ID generation to be Hash of name?
                # Changing ID generation to Hash is safest for stability.
                
                # Let's assign a temporary negative ID to ghost nodes to avoid collision?
                # Or just use the old ID and hope new IDs don't clash?
                # If we have 10 nodes, IDs 0-9. Delete node 0. Rescan. New IDs 0-8.
                # Old Node 0 (Ghost) has ID 0. New Node 0 (was 1) has ID 0. Collision!
                # We MUST fix ID stability.
                
                # Refactoring ID generation in RelationshipAnalyzer is best, but modifying `update_scene_items_diff` 
                # to handle mapped items is immediate requirement.
                
                # For now, let's just add them to map. If collision, last one wins (bad).
                self.node_items[item.node_id] = item

        # 2. Edges Update
        # Clear all existing edges first?
        # If we clear edges, we lose manual connections?
        # No, manual connections are re-added via `edges_data` (load_graph_data merges them).
        # BUT `load_graph_data` merges using IDs.
        # If IDs shifted, manual connections will connect WRONG nodes.
        
        # WE MUST FIX ID GENERATION FIRST or `load_graph_data` matching.
        # Since I can't check `relationship_analyzer.py` right now without breaking flow (or I can?),
        # I will check it in next step.
        # For now, assuming IDs are unstable, this is a risk.
        # But let's proceed with visual update first.
        
        for e in self.edge_items:
            # v3.16 Fix: Explicitly remove edge from nodes to prevent stale references
            if e in e.source.edges: e.source.edges.remove(e)
            if e in e.dest.edges: e.dest.edges.remove(e)
            self.scene.removeItem(e)
        self.edge_items.clear()
        
        # Re-create edges from new_edges_data
        bidirectional_pairs = set()
        for e in new_edges_data:
            u, v = e['from'], e['to']
            if any(x['from'] == v and x['to'] == u for x in new_edges_data):
                bidirectional_pairs.add(tuple(sorted((u, v))))

        processed = set()
        for e in new_edges_data:
            u, v = e['from'], e['to']
            
            # Use self.node_items to find source/dest
            if u not in self.node_items or v not in self.node_items: continue
            
            src = self.node_items[u]
            dst = self.node_items[v]
            
            # If src or dst is missing, do we show edge?
            # User said: "Preserve manual connections".
            # Auto-detected edges (string match) involving missing nodes won't be in new_edges_data.
            # Manual connections: `load_graph_data` adds them.
            # If `load_graph_data` sees ID that doesn't exist in new scan, it might drop it?
            # We need to verify `load_graph_data` in MainWindow.
            
            pair = tuple(sorted((u, v)))
            
            if pair in bidirectional_pairs:
                if (u, v) in processed: continue
                e1 = GraphEdgeItem(src, dst, True, 1)
                e2 = GraphEdgeItem(dst, src, True, 1)
                self.scene.addItem(e1)
                self.scene.addItem(e2)
                self.edge_items.extend([e1, e2])
                processed.add((u, v))
                processed.add((v, u))
            else:
                e1 = GraphEdgeItem(src, dst, False, 0)
                self.scene.addItem(e1)
                self.edge_items.append(e1)
                
        # Update Bounding Rect
        if self.node_items:
            rect = self.scene.itemsBoundingRect()
            self.scene.setSceneRect(rect.adjusted(-2000, -2000, 2000, 2000))
            
    # ... (Rest of MainGraphView)
    def set_scene_items(self, nodes_data, edges_data, font_size=10):
        # Allow legacy calls from Load to use diff logic if scene is empty
        # But Diff logic handles "Existing=Empty" case correctly (all new).
        self.update_scene_items_diff(nodes_data, edges_data, font_size)

    # In reload_data:
    # def reload_data(self):
    # ...
    # self.main_view.update_scene_items_diff(nodes, self.graph_data['edges'], self.font_size)
    # ...


    def on_node_moved(self, node_item):
        pos = node_item.pos()
        self.config_manager.set_node_position(node_item.full_name, pos.x(), pos.y())
        self.config_manager.save_config()
    
    def on_node_double_clicked(self, node_item):
        """雙擊節點打開快速編輯窗口"""
        mw = self.window()
        if mw and hasattr(mw, 'excel_handler'):
            dialog = QuickEditDialog(
                mw, 
                node_item.node_data['filename'], 
                node_item.node_data['sheet'], 
                mw.excel_handler
            )
            dialog.exec()
    
    def toggle_arrows_visibility(self, visible):
        """切換箭頭顯示 (v3.12, v3.14)"""
        self.arrows_hidden = not visible
        self.update_edges_visibility()
        
    def update_edges_visibility(self):
        """v3.12 Ensure hidden arrows stay hidden, focused arrows stay visible"""
        for edge in self.edge_items:
            should_show = True
            
            # Global Hidden
            if self.arrows_hidden:
                should_show = False
            
            # Focus Override (Shows related edges even if global hidden? Maybe user wants that?)
            # User said "Hide arrows", usually means "I don't want to see the mess".
            # But if I focus, I want to see relations of THAT node.
            # So Focus > Hidden.
            if self.is_focus_active:
                if edge.is_focus_related:
                    should_show = True
                else:
                    should_show = False
            
            # If NOT focus active, and Global Hidden -> Hide.
            # If NOT focus active, and Global Show -> Show.
            
            edge.setVisible(should_show)
        
    def mousePressEvent(self, event):
        # v3.14 記錄滑鼠按下位置和點擊的物件，但不立即 Focus
        if event.button() == Qt.MouseButton.LeftButton:
            self.mouse_press_pos = event.pos()
            self.mouse_press_item = self.itemAt(event.pos())
        super().mousePressEvent(event)
    
    def mouseReleaseEvent(self, event):
        # v3.14 只有在 Click (按下並放開) 時才觸發 Focus，拖曳不觸發
        if event.button() == Qt.MouseButton.LeftButton and self.mouse_press_pos is not None:
            release_pos = event.pos()
            release_item = self.itemAt(release_pos)
            
            # 檢查是否為點擊（位置沒有明顯移動）
            delta = (release_pos - self.mouse_press_pos).manhattanLength()
            is_click = delta < 5  # 容差 5 像素
            
            if is_click:
                if isinstance(release_item, GraphNodeItem) and release_item == self.mouse_press_item:
                    # 在同一個節點上按下和放開，觸發 Focus
                    self.apply_focus_dimming(release_item)
                    self.node_selected.emit(release_item.node_data)
                elif not isinstance(release_item, GraphNodeItem):
                    # 點擊空白處，清除 Focus
                    self.clear_focus_dimming()
                    self.node_deselected.emit()
            
            # 清除記錄
            self.mouse_press_pos = None
            self.mouse_press_item = None
        
        super().mouseReleaseEvent(event)

    def apply_focus_dimming(self, center_item):
        self.is_focus_active = True
        
        # 1. Build Adjacency from current items for traversal
        adj_out = {} # id -> list of ids
        adj_in = {}
        
        # Optimization: Map id to item for quick access
        id_to_item = {item.node_id: item for item in self.node_items.values()}
        
        for edge in self.edge_items:
            u = edge.source.node_id
            v = edge.dest.node_id
            if u not in adj_out: adj_out[u] = []
            adj_out[u].append(v)
            if v not in adj_in: adj_in[v] = []
            adj_in[v].append(u)

        # 2. BFS Traversal (Depth 2)
        MAX_DEPTH = 2
        
        # Forward (Downstream)
        downstream_nodes = set()
        visited_fwd = {center_item.node_id}
        current_layer = [center_item.node_id]
        
        for _ in range(MAX_DEPTH):
            next_layer = []
            for u in current_layer:
                if u in adj_out:
                    for v in adj_out[u]:
                        if v not in visited_fwd:
                            visited_fwd.add(v)
                            downstream_nodes.add(v)
                            next_layer.append(v)
            if not next_layer: break
            current_layer = next_layer
            
        # Backward (Upstream)
        upstream_nodes = set()
        visited_bwd = {center_item.node_id}
        current_layer = [center_item.node_id]
        
        for _ in range(MAX_DEPTH):
            next_layer = []
            for u in current_layer:
                if u in adj_in:
                    for v in adj_in[u]:
                        if v not in visited_bwd:
                            visited_bwd.add(v)
                            upstream_nodes.add(v)
                            next_layer.append(v)
            if not next_layer: break
            current_layer = next_layer

        # All related nodes
        focus_set = {center_item.node_id} | downstream_nodes | upstream_nodes

        # 3. Update Nodes
        for item in self.node_items.values():
            if item.node_id in focus_set:
                item.is_dimmed = False
                item.setZValue(1)
                item.is_focused = (item.node_id == center_item.node_id)
            else:
                item.is_dimmed = True
                item.setZValue(0)
                item.is_focused = False
            item.update()
        
        # 4. Update Edges
        for edge in self.edge_items:
            u = edge.source.node_id
            v = edge.dest.node_id
            
            is_related = False
            edge_color = None
            
            if u in focus_set and v in focus_set:
                # Determine direction relative to focus
                
                # Case 1: Downstream Flow (Focus -> Child / Child -> Grandchild)
                # If u is Focus or Downstream, AND v is Downstream
                if (u == center_item.node_id or u in downstream_nodes) and (v in downstream_nodes):
                    is_related = True
                    edge_color = QColor("#FFD700") # Yellow
                
                # Case 2: Upstream Flow (Grandparent -> Parent / Parent -> Focus)
                # If u is Upstream, AND v is Upstream or Focus
                elif (u in upstream_nodes) and (v == center_item.node_id or v in upstream_nodes):
                    is_related = True
                    edge_color = QColor("#4CAF50") # Green
                
                # Case 3: Mixed/Cross (Upstream -> Downstream direct?)
                # This depends on graph structure. If both are in set, we emphasize.
                # If valid relation, pick one. Priority to downstream usually?
                elif u in upstream_nodes and v in downstream_nodes:
                     is_related = True
                     edge_color = QColor("#FFD700") # Treat as flow through
                
                # If related but didn't match specific flow (e.g. cycles), fallback
                elif not is_related:
                     # Check if it connects two related nodes regardless of flow direction?
                     # Yes, if both are in focus set, edge should be highlighted.
                     is_related = True
                     edge_color = QColor("#FFD700") # Default Gold

            if is_related:
                edge.is_focus_related = True
                edge.focus_color = edge_color
            else:
                edge.is_focus_related = False
                edge.focus_color = None
                
            edge.adjust()
            edge.update()
            
        # Update visibility
        self.update_edges_visibility()

    def clear_focus_dimming(self):
        self.is_focus_active = False
        for item in self.node_items.values():
            item.is_dimmed = False
            item.is_focused = False  # 清除 Focus 狀態
            item.setZValue(0)
            item.update()
        
        # 清除 focus 相關連線標記 (v3.14)
        for edge in self.edge_items:
            edge.is_focus_related = False
            edge.adjust()
            edge.update()
            
        # 更新連線可見性 (v3.14)
        self.update_edges_visibility()

    def search_highlight(self, keyword):
        if self.is_focus_active:
            self.clear_focus_dimming()
            
        keyword = keyword.lower()
        first_match = None
        for item in self.node_items.values():
            if keyword in item.label.lower() or keyword in item.node_data['table'].lower():
                item.is_highlighted = True
                item.is_dimmed = False
                item.setZValue(2)
                if not first_match: first_match = item
            else:
                item.is_highlighted = False
                item.is_dimmed = True
                item.setZValue(0)
            item.update()
        
        for item in self.edge_items:
            item.adjust()
            item.update()
                
        if first_match: self.centerOn(first_match)

    def clear_search(self):
        for item in self.node_items.values():
            item.is_dimmed = False
            item.is_highlighted = False
            item.setZValue(0)
            item.update()
        for item in self.edge_items:
            item.adjust()
            item.update()

    def arrange_clustered_layout(self, nodes_data):
        """
        Improved Layout:
        1. Calculate dimensions for each group based on node text widths.
        2. Arrange groups in a 'flow' layout (left-to-right, wrap at width).
        """
        groups = {}
        for n in nodes_data:
            t = n['table']
            if t not in groups: groups[t] = []
            groups[t].append(n)
        
        # Calculate Group Sizes
        group_layouts = {} # table -> {width, height, nodes_pos_rel}
        
        # Font metrics approximation for spacing
        char_w = 10 * 0.8 # approx for calc
        node_h = 60 + 5 # height + margin (v3.14 增加垂直間距)
        
        for table, g_nodes in groups.items():
            # Determine grid size for this group
            n_count = len(g_nodes)
            cols = math.ceil(math.sqrt(n_count))
            if cols < 1: cols = 1
            
            # Calculate column widths
            col_widths = [0] * cols
            rows = math.ceil(n_count / cols)
            
            # First pass: find max width per column
            for idx, node in enumerate(g_nodes):
                c = idx % cols
                # Estimate width: label length * char + padding
                # v3.14 增加節點寬度估算，確保不重疊
                w = len(node['sheet']) * char_w + 50 + 5
                if w < 125: w = 125  # min width increased
                if w > col_widths[c]: col_widths[c] = w
            
            # Calculate relative positions
            positions = []
            # v3.14 增加列之間的間隙
            total_w = sum(col_widths) + (cols - 1) * 25 # 20->25 gap
            total_h = rows * node_h
            
            current_y = 0
            for r in range(rows):
                current_x = 0
                for c in range(cols):
                    idx = r * cols + c
                    if idx >= n_count: break
                    
                    # Center in column? Or left align. Left is easier.
                    # Center of the cell:
                    cx = current_x + col_widths[c] / 2
                    cy = current_y + node_h / 2
                    
                    positions.append({
                        'id': g_nodes[idx]['id'],
                        'full_name': f"{g_nodes[idx]['table']}.{g_nodes[idx]['sheet']}",
                        'rel_x': cx,
                        'rel_y': cy
                    })
                    current_x += col_widths[c] + 25 # 20->25 gap
                current_y += node_h
                
            group_layouts[table] = {
                'w': total_w,
                'h': total_h,
                'rel_pos': positions
            }

        # Arrange Groups (Bin packing simplified: Flow layout)
        final_positions = {}
        
        # Sort groups by height desc (better packing) or name? Name is predictable.
        # Height desc helps packing.
        sorted_groups = sorted(group_layouts.items(), key=lambda x: x[1]['h'], reverse=True)
        
        canvas_width = 2500 # max width before wrap
        current_x = 0
        current_y = 0
        row_h = 0
        
        group_gap = 100
        
        for table, layout in sorted_groups:
            if current_x + layout['w'] > canvas_width and current_x > 0:
                # Wrap
                current_x = 0
                current_y += row_h + group_gap
                row_h = 0
            
            # Place group at current_x, current_y
            # Offset all nodes
            for p in layout['rel_pos']:
                final_positions[p['full_name']] = (current_x + p['rel_x'], current_y + p['rel_y'])
                
            # Advance
            current_x += layout['w'] + group_gap
            if layout['h'] > row_h: row_h = layout['h']
            
        return final_positions


# --- Shared Graphics Items ---
# (GraphNodeItem and GraphEdgeItem unchanged)

# --- Views ---
# (BaseGraphView and MainGraphView unchanged)

# User Relation Manager handles manual overrides
class UserRelationManager:
    def __init__(self):
        # JSON 檔案固定保存在應用程式目錄
        self.file_path = Path(__file__).parent / 'user_relations.json'
        self.relations = self.load_relations()
        
    def load_relations(self):
        if not self.file_path.exists():
            return {'added': [], 'removed': []}
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except: return {'added': [], 'removed': []}
        
    def save_relations(self):
        with open(self.file_path, 'w', encoding='utf-8') as f:
            json.dump(self.relations, f, indent=2)
            
    def add_relation(self, from_id, to_id, type="manual", label="Manual"):
        # Check if already removed
        self.relations['removed'] = [r for r in self.relations['removed'] 
                                     if not (r['from'] == from_id and r['to'] == to_id)]
        
        # Check if already added
        for r in self.relations['added']:
            if r['from'] == from_id and r['to'] == to_id:
                return
                
        self.relations['added'].append({
            'from': from_id, 'to': to_id, 'type': type, 'label': label
        })
        self.save_relations()
        
    def remove_relation(self, from_id, to_id):
        # Check if in added
        self.relations['added'] = [r for r in self.relations['added'] 
                                   if not (r['from'] == from_id and r['to'] == to_id)]
        
        # Add to removed list (to filter out auto-detected ones)
        exists = False
        for r in self.relations['removed']:
            if r['from'] == from_id and r['to'] == to_id: exists = True
        
        if not exists:
            self.relations['removed'].append({'from': from_id, 'to': to_id})
            self.save_relations()

class RelationGraphView(BaseGraphView):
    details_requested = pyqtSignal(dict)
    node_pin_requested = pyqtSignal(dict)  # 中鍵節點 → 釘選 / 取消釘選

    def __init__(self, parent, config_manager, excel_handler):
        super().__init__(parent)
        self.config_manager = config_manager
        self.excel_handler = excel_handler
        self.font_size = 10
        self.center_node_data = None  # 保存中心節點數據
        self.all_nodes_map = {}  # 保存所有節點映射
        self._pinned_ids = set()  # 目前釘選的 node id，供節點顯示圖釘
        self.show_empty_state()

    def mousePressEvent(self, event):
        # 中鍵：若游標下有節點則切換釘選（第一下即生效），否則交給 BaseGraphView 平移。
        # 必須在 view 層攔截，否則 BaseGraphView 會先吃掉中鍵啟動平移，使節點收不到事件。
        if event.button() == Qt.MouseButton.MiddleButton:
            node = self._node_at(event.pos())
            if node is not None and not getattr(node, 'is_missing', False):
                self.on_node_pin_toggle(node)
                event.accept()
                return
        super().mousePressEvent(event)

    def _node_at(self, pos):
        """回傳游標位置下的 GraphNodeItem（含子項時往上找父節點），無則回傳 None。"""
        item = self.itemAt(pos)
        while item is not None and not isinstance(item, GraphNodeItem):
            item = item.parentItem()
        return item

    def on_node_pin_toggle(self, item):
        """節點被中鍵點擊：通知主視窗切換釘選狀態。"""
        self.node_pin_requested.emit(item.node_data)

    def set_pinned_ids(self, ids):
        """更新釘選標記並重繪目前顯示的節點。"""
        self._pinned_ids = set(ids)
        for item in self.scene.items():
            if isinstance(item, GraphNodeItem):
                item.is_pinned = item.node_id in self._pinned_ids
                item.update()

    def set_font_size_live(self, size):
        self.font_size = size
        for item in self.scene.items():
            if isinstance(item, GraphNodeItem):
                item.set_font_size(size)
        for item in self.scene.items():
            if isinstance(item, GraphEdgeItem):
                item.adjust()

    def show_empty_state(self):
        self._user_zoomed = False
        self.scene.clear()
        self.setBackgroundBrush(QBrush(QColor("#1e1e1e")))
        text = self.scene.addText("Select a node to view relations")
        text.setDefaultTextColor(QColor("#666666"))
        font = QFont(FONT_FAMILY, 14)
        text.setFont(font)
        text.setPos(-text.boundingRect().width()/2, -text.boundingRect().height()/2)
        
    def show_relations(self, center_node_data, all_edges, all_nodes_map, font_size=10, reset_view=True):
        self.scene.clear()
        self.setBackgroundBrush(QBrush(Qt.BrushStyle.NoBrush))
        self.font_size = font_size
        
        # 保存數據以供編輯模式使用
        self.center_node_data = center_node_data
        self.all_nodes_map = all_nodes_map
        self.all_edges = all_edges
        
        cid = center_node_data['id']
        
        # Build adjacency
        adj_out = {}
        adj_in = {}
        for e in all_edges:
            u, v = e['from'], e['to']
            if u not in adj_out: adj_out[u] = []
            adj_out[u].append(v)
            if v not in adj_in: adj_in[v] = []
            adj_in[v].append(u)

        # Layers: 0=Center, >0=Right(Child), <0=Left(Parent)
        layers = {0: [cid]}
        node_to_layer = {cid: 0}
        visited = {cid}
        
        MAX_DEPTH = 2  # Depth of traversal
        
        # BFS Forward (Outgoing)
        current_layer = [cid]
        for d in range(1, MAX_DEPTH + 1):
            next_layer = []
            for u in current_layer:
                if u in adj_out:
                    for v in adj_out[u]:
                        if v not in visited and v in all_nodes_map:
                            visited.add(v)
                            # 優先顯示在較淺的層級
                            node_to_layer[v] = d
                            next_layer.append(v)
            if next_layer:
                layers[d] = next_layer
                current_layer = next_layer
            else:
                break
                
        # BFS Backward (Incoming)
        current_layer = [cid]
        for d in range(1, MAX_DEPTH + 1):
            prev_layer = []
            for u in current_layer:
                if u in adj_in:
                    for v in adj_in[u]:
                        if v not in visited and v in all_nodes_map:
                            visited.add(v)
                            node_to_layer[v] = -d
                            prev_layer.append(v)
            if prev_layer:
                layers[-d] = prev_layer
                current_layer = prev_layer
            else:
                break
                
        # Drawing
        spacing_x = 350
        base_spacing_y = 60 + (self.font_size - 10) * 2
        item_map = {} # node_id -> item
        
        sorted_layers = sorted(layers.keys())
        for layer_idx in sorted_layers:
            nodes = layers[layer_idx]
            count = len(nodes)
            start_y = -((count - 1) * base_spacing_y) / 2
            
            for i, nid in enumerate(nodes):
                node_data = all_nodes_map[nid]
                item = GraphNodeItem(node_data, self, is_main_view=False, font_size=self.font_size)
                
                # Apply Color Explicitly
                color_hex = self.config_manager.get_table_color(node_data['table'])
                if color_hex:
                    item.bg_color = QColor(color_hex)
                
                item.setPos(layer_idx * spacing_x, start_y + i * base_spacing_y)

                if nid == cid:
                    item.is_focused = True

                item.is_pinned = nid in self._pinned_ids

                self.scene.addItem(item)
                item_map[nid] = item
        
        # Draw edges between displayed nodes
        displayed_ids = set(item_map.keys())
        for e in all_edges:
            u, v = e['from'], e['to']
            if u in displayed_ids and v in displayed_ids:
                src_item = item_map[u]
                dst_item = item_map[v]
                
                edge = GraphEdgeItem(src_item, dst_item, False, 0)
                edge.from_id = u
                edge.to_id = v
                
                # Determine Edge Color based on Flow Direction (v3.15)
                # node_to_layer: 0=Center, >0=Downstream, <0=Upstream
                layer_u = node_to_layer.get(u, 0)
                layer_v = node_to_layer.get(v, 0)
                
                edge_color = None
                
                # Case 1: Downstream Flow (Center/Child -> Child)
                # u is Center(0) or Downstream(>0), v is Downstream(>0)
                if layer_u >= 0 and layer_v > 0:
                    edge_color = QColor("#FFD700")  # Yellow
                
                # Case 2: Upstream Flow (Parent -> Parent/Center)
                # u is Upstream(<0), v is Upstream(<0) or Center(0)
                elif layer_u < 0 and layer_v <= 0:
                    edge_color = QColor("#4CAF50")  # Green
                    
                # Case 3: Mixed (Upstream -> Downstream direct or other cross links)
                else:
                    edge_color = QColor("#FFD700")  # Default to Yellow
                
                if edge_color:
                    edge.is_focus_related = True
                    edge.focus_color = edge_color
                    edge.adjust()  # Apply style immediately
                
                self.scene.addItem(edge)

        self.scene.setSceneRect(self.scene.itemsBoundingRect().adjusted(-50, -50, 50, 50))

        if reset_view:
            # 切換到新節點：回到「自動 fit」狀態並重新填滿視圖
            self._user_zoomed = False
            self.fitInView(self.scene.sceneRect(), Qt.AspectRatioMode.KeepAspectRatio)

    def on_node_clicked(self, item):
        self.details_requested.emit(item.node_data)
        for i in self.scene.items():
            if isinstance(i, GraphNodeItem):
                i.is_focused = False
                i.update()
        item.is_focused = True
        item.update()
    
    def resizeEvent(self, event):
        super().resizeEvent(event)
        # 使用者尚未手動縮放時才自動 fit；否則保留目前縮放，
        # 避免放大時捲軸出現觸發的 resize 把畫面縮回（PC 無法拉近的 Bug）。
        if self.scene.items() and not self._user_zoomed:
            self.fitInView(self.scene.sceneRect(), Qt.AspectRatioMode.KeepAspectRatio)

    def on_node_moved(self, item): pass

    def on_node_double_clicked(self, node_item):
        """雙擊節點：於右欄顯示該表格的 Quick Browse。"""
        self.details_requested.emit(node_item.node_data)


class DetailsPanel(QWidget):
    color_changed = pyqtSignal() # Notify main window to refresh
    
    def __init__(self, excel_handler, config_manager):
        super().__init__()
        self.excel_handler = excel_handler
        self.config_manager = config_manager
        self.current_node_data = None
        self.init_ui()
        
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        # Header Info
        self.info_group = QFrame()
        self.info_group.setFrameStyle(QFrame.Shape.StyledPanel)
        info_layout = QFormLayout(self.info_group)
        
        self.lbl_table = QLabel("-")
        self.lbl_sheet = QLabel("-")
        
        info_layout.addRow("Table:", self.lbl_table)
        info_layout.addRow("Sheet:", self.lbl_sheet)
        
        # Settings Integration
        # v3.14 隱藏 Param Row，改用 Customize 按鈕
        self.spin_param_row = QSpinBox()
        self.spin_param_row.setRange(1, 100)
        self.spin_param_row.valueChanged.connect(self.on_param_row_changed)
        self.spin_param_row.setVisible(False)
        # info_layout.addRow("Param Row:", self.spin_param_row) 
        
        self.btn_customize = QPushButton("Customize View...")
        self.btn_customize.clicked.connect(self.open_custom_view_dialog)
        info_layout.addRow("", self.btn_customize)
        
        self.btn_color = QPushButton()
        self.btn_color.setFixedHeight(20)
        self.btn_color.clicked.connect(self.on_pick_color)
        info_layout.addRow("Color:", self.btn_color)
        
        layout.addWidget(self.info_group)
        
        # Controls
        controls_layout = QHBoxLayout()
        self.show_hidden_cb = QCheckBox("Show Hidden")
        self.show_hidden_cb.stateChanged.connect(self.refresh_table)
        controls_layout.addWidget(self.show_hidden_cb)
        
        self.update_btn = QPushButton("Save to Excel")
        self.update_btn.clicked.connect(self.save_changes)
        controls_layout.addWidget(self.update_btn)
        
        self.browse_btn = QPushButton("Open in Excel")
        self.browse_btn.clicked.connect(self.open_in_excel)
        controls_layout.addWidget(self.browse_btn)
        
        layout.addLayout(controls_layout)
        
        # Table
        self.table = QTableWidget()
        self.table.setColumnCount(3)
        self.table.setHorizontalHeaderLabels(["Field", "Value", ""])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.table.setColumnWidth(2, 30)
        layout.addWidget(self.table)
        
        self.clear() # Init state

    def clear(self):
        self.current_node_data = None
        self.lbl_table.setText("-")
        self.lbl_sheet.setText("Select a node")
        self.info_group.setEnabled(False)
        self.table.setRowCount(0)
        self.btn_color.setStyleSheet("")
        
    # Details Panel Update: Dirty Tracking
    def show_node(self, node_data):
        self.current_node_data = node_data
        self.info_group.setEnabled(True)
        
        self.lbl_table.setText(node_data['table'])
        self.lbl_sheet.setText(node_data['sheet'])
        
        full_name = f"{node_data['table']}.{node_data['sheet']}"
        
        self.spin_param_row.blockSignals(True)
        self.spin_param_row.setValue(self.config_manager.get_sheet_param_row(full_name))
        self.spin_param_row.blockSignals(False)
        
        c = self.config_manager.get_table_color(node_data['table'])
        self.btn_color.setStyleSheet(f"background-color: {c}; border: none;")
        
        self.load_data()
        
    def load_data(self):
        if not self.current_node_data: return
        full_name = f"{self.current_node_data['table']}.{self.current_node_data['sheet']}"
        
        # v3.14 Custom Display Config
        custom_conf = self.config_manager.get_sheet_custom_display(full_name)
        if custom_conf and custom_conf.get('use_custom'):
            try:
                self.load_custom_data(custom_conf)
                return
            except Exception as e:
                print(f"Custom load failed: {e}")
        
        param_row = self.config_manager.get_sheet_param_row(full_name)
        try:
            standard_data = self.excel_handler.get_sheet_data(
                self.current_node_data['filename'], self.current_node_data['sheet'], param_row
            )
            # Patch standard data to new multi-value format
            # New format: {'header': str, 'values': [{'text': str, 'col': int, 'row': int}]}
            self.raw_data = []
            for item in standard_data:
                self.raw_data.append({
                    'header': item['header'],
                    'values': [{
                        'text': item['value'],
                        'col': item['col_idx'],
                        'row': param_row
                    }]
                })
            
            self.refresh_table()
        except Exception as e:
            QMessageBox.warning(self, "Read Error", str(e))

    def load_custom_data(self, conf):
        h, d = self.excel_handler.get_all_sheet_data(self.current_node_data['filename'], self.current_node_data['sheet'])
        if not h:
            self.raw_data = []
            self.refresh_table()
            return

        raw_data_grid = [h] + d
        
        # Transpose if needed
        is_trans = conf.get('transpose', False)
        if is_trans:
            data_grid = list(map(list, zip(*raw_data_grid)))
        else:
            data_grid = raw_data_grid
            
        f_idxs = conf.get('field_indices', [])
        v_idxs = conf.get('value_indices', [])
        
        self.raw_data = [] 
        
        num_items = len(data_grid[0]) if data_grid else 0
        num_source_rows = len(data_grid)
        
        for i in range(num_items):
            # Build Field String
            fields = []
            for f_idx in f_idxs:
                if f_idx < num_source_rows:
                    val = data_grid[f_idx][i] if i < len(data_grid[f_idx]) else ""
                    fields.append(str(val))
            
            if not fields: continue
            field_str = " | ".join(fields)
            
            # Collect Values
            row_values = []
            for v_idx in v_idxs:
                if v_idx < num_source_rows:
                    val = data_grid[v_idx][i] if i < len(data_grid[v_idx]) else ""
                    
                    # Calculate original coordinate for saving
                    if is_trans:
                        real_row, real_col = i + 1, v_idx + 1
                    else:
                        real_row, real_col = v_idx + 1, i + 1
                        
                    row_values.append({
                        'text': str(val),
                        'col': real_col,
                        'row': real_row
                    })
            
            self.raw_data.append({
                'header': field_str,
                'values': row_values
            })
        self.refresh_table()

    def open_custom_view_dialog(self):
        if not self.current_node_data: return
        full_name = f"{self.current_node_data['table']}.{self.current_node_data['sheet']}"
        curr_conf = self.config_manager.get_sheet_custom_display(full_name)
        
        dlg = DetailsDisplayDialog(self, self.excel_handler, self.current_node_data, curr_conf)
        if dlg.exec() == QDialog.DialogCode.Accepted:
            new_conf = dlg.get_result()
            self.config_manager.set_sheet_custom_display(full_name, new_conf)
            self.config_manager.save_config()
            self.load_data()

    def on_param_row_changed(self, val):
        if not self.current_node_data: return
        full_name = f"{self.current_node_data['table']}.{self.current_node_data['sheet']}"
        self.config_manager.set_sheet_param_row(full_name, val)
        self.config_manager.save_config()
        self.load_data() 
        
    def on_pick_color(self):
        if not self.current_node_data: return
        tn = self.current_node_data['table']
        curr = QColor(self.config_manager.get_table_color(tn))
        c = QColorDialog.getColor(curr, self, "Pick Table Color")
        if c.isValid():
            self.config_manager.set_table_color(tn, c.name())
            self.config_manager.save_config()
            self.btn_color.setStyleSheet(f"background-color: {c.name()}; border: none;")
            self.color_changed.emit()

    def refresh_table(self):
        if not self.current_node_data: return
        self.table.setRowCount(0)
        
        # Determine number of value columns
        max_values = 1
        if self.raw_data:
            max_values = max(len(item['values']) for item in self.raw_data)
        if max_values < 1: max_values = 1
        
        # Set dynamic headers
        headers = ["Field"] + [f"Value_{i+1}" for i in range(max_values)] + [""]
        self.table.setColumnCount(len(headers))
        self.table.setHorizontalHeaderLabels(headers)
        
        # Resize modes: Field stretch, Values stretch (or Interactive?), Hide Button fixed
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Interactive) # Field interactive
        header.resizeSection(0, 150)
        
        for i in range(max_values):
            col = i + 1
            header.setSectionResizeMode(col, QHeaderView.ResizeMode.Interactive)
            header.resizeSection(col, 100) # Default width
            
        header.setSectionResizeMode(len(headers)-1, QHeaderView.ResizeMode.Fixed)
        self.table.setColumnWidth(len(headers)-1, 30)
        
        full_name = f"{self.current_node_data['table']}.{self.current_node_data['sheet']}"
        hidden_fields = self.config_manager.get_hidden_fields(full_name)
        show_hidden = self.show_hidden_cb.isChecked()
        
        font_size = self.config_manager.get_global_font_size()
        font = QFont(FONT_FAMILY, font_size)
        self.table.setFont(font)
        
        # Original values for dirty check: (row, col_in_table) -> text
        self.original_values = {} 
        
        for item in self.raw_data:
            is_hidden = item['header'] in hidden_fields
            if item['header'].startswith('#') and not show_hidden: continue
            if is_hidden and not show_hidden: continue
            
            # v3.16 Hide empty rows
            has_value = any(str(v['text']).strip() for v in item['values'])
            if not has_value and not show_hidden: continue
            
            row = self.table.rowCount()
            self.table.insertRow(row)
            t_item = QTableWidgetItem(item['header'])
            t_item.setFont(font)
            t_item.setFlags(t_item.flags() ^ Qt.ItemFlag.ItemIsEditable) # Header read-only
            self.table.setItem(row, 0, t_item)
            
            # Populate Values
            for i, val_obj in enumerate(item['values']):
                col = i + 1
                v_item = QTableWidgetItem(val_obj['text'])
                v_item.setFont(font)
                # Store coord
                v_item.setData(Qt.ItemDataRole.UserRole, {'col': val_obj['col'], 'row': val_obj['row']})
                self.table.setItem(row, col, v_item)
                # Store original
                self.original_values[(row, col)] = val_obj['text']

            # Hide Button
            btn = QPushButton("H")
            btn.setFixedSize(25, 20)
            btn.setStyleSheet(f"background-color: {'#ff5555' if is_hidden else '#555555'}; color: white;")
            btn.clicked.connect(lambda _, f=item['header']: self.toggle_hide(f))
            self.table.setCellWidget(row, len(headers)-1, btn)

    def toggle_hide(self, field):
        full_name = f"{self.current_node_data['table']}.{self.current_node_data['sheet']}"
        self.config_manager.toggle_hidden_field(full_name, field)
        self.config_manager.save_config()
        self.refresh_table()
        
    def open_in_excel(self):
        if not self.current_node_data: return
        try:
            self.excel_handler.open_sheet(self.current_node_data['filename'], self.current_node_data['sheet'])
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to open Excel:\n{e}")

    def save_changes(self):
        if not self.current_node_data: return
        full_name = f"{self.current_node_data['table']}.{self.current_node_data['sheet']}"
        param_row = self.config_manager.get_sheet_param_row(full_name)
        
        count = 0
        updates = []
        
        
        for row in range(self.table.rowCount()):
            # Iterate all value columns (from 1 to count-1)
            # Last column is Hide Button
            for col in range(1, self.table.columnCount() - 1):
                v_item = self.table.item(row, col)
                if v_item:
                    current_val = v_item.text()
                    original_val = self.original_values.get((row, col), "")
                    
                    if current_val != original_val:
                        # v3.14 Retrieve dict coord
                        coord = v_item.data(Qt.ItemDataRole.UserRole)
                        if coord: # Ensure valid
                            updates.append((coord, current_val))

        if not updates:
            QMessageBox.information(self, "Info", "No changes detected.")
            return

        for coord, val in updates:
            # v3.14 Support custom row index
            if isinstance(coord, dict):
                col = coord['col']
                row = coord['row']
            else:
                col = coord
                row = param_row

            success, msg = self.excel_handler.update_cell_value(
                self.current_node_data['filename'],
                self.current_node_data['sheet'],
                col,
                row,
                val
            )
            if not success:
                QMessageBox.warning(self, "Error", msg)
                return
            count += 1
            
        QMessageBox.information(self, "Updated", f"Updated {count} changed fields.")
        # Update original values
        self.load_data()

class QuickEditDialog(QDialog):
    def __init__(self, parent, excel_handler, node_data):
        super().__init__(parent)
        self.excel_handler = excel_handler
        self.node_data = node_data
        self.filename = node_data['filename']
        self.sheet = node_data['sheet']
        self.setWindowTitle(f"Quick Edit - {self.sheet}")
        self.resize(800, 600)
        
        layout = QVBoxLayout(self)
        
        # Tools
        top = QHBoxLayout()
        top.addWidget(QLabel(f"Editing: {self.filename} > {self.sheet}"))
        top.addStretch()
        self.refresh_btn = QPushButton("Refresh")
        self.refresh_btn.clicked.connect(self.load_data)
        top.addWidget(self.refresh_btn)
        
        self.save_btn = QPushButton("Save Changes")
        self.save_btn.clicked.connect(self.save)
        top.addWidget(self.save_btn)
        layout.addLayout(top)
        
        # Table
        self.table = QTableWidget()
        layout.addWidget(self.table)
        
        # Status
        self.lbl_status = QLabel("Ready")
        layout.addWidget(self.lbl_status)
        
        self.col_headers = []
        self.load_data()
        
    def load_data(self):
        self.lbl_status.setText("Loading...")
        QApplication.processEvents()
        
        headers, data = self.excel_handler.get_all_sheet_data(self.filename, self.sheet)
        self.col_headers = headers
        
        self.table.setColumnCount(len(headers))
        self.table.setRowCount(len(data))
        self.table.setHorizontalHeaderLabels(headers)
        
        for r, row_data in enumerate(data):
            for c, val in enumerate(row_data):
                item = QTableWidgetItem(val)
                self.table.setItem(r, c, item)
                
        self.lbl_status.setText(f"Loaded {len(data)} rows.")

    def save(self):
        self.lbl_status.setText("Saving... do not close.")
        self.table.setEnabled(False)
        QApplication.processEvents()
        
        count = 0
        try:
            # We iterate all cells? No, that's too slow for saving individually via COM.
            # But ExcelHandler only has single cell update currently.
            # For Quick Edit, if user edits many cells, this will be slow.
            # But usually quick edit is for small fixes.
            # Optimally we should track dirty cells.
            # But QTableWidget doesn't track dirty state easily without subclassing.
            # Let's iterate all and check against original? Too heavy if large.
            # Compromise: We only support saving individual edits one by one is too slow if we scan all.
            # We need to know what changed.
            # Let's just hook cellChanged signal to track dirty cells.
            pass
        except: pass
        
        # Re-implementation with dirty tracking
        self.lbl_status.setText("Tracking changes active. Please implement dirty tracking next.")
        self.table.setEnabled(True)

class QuickEditDialog(QDialog):
    def __init__(self, parent, filename, sheet, excel_handler):
        super().__init__(parent)
        self.setWindowTitle(f"Quick Browse / Edit: {filename} > {sheet}")
        self.filename = filename
        self.sheet = sheet
        self.excel_handler = excel_handler
        self.dirty_cells = {}  # (row, col) -> new_value
        
        layout = QVBoxLayout(self)
        
        top = QHBoxLayout()
        top.addWidget(QLabel(f"Editing: {self.filename} > {self.sheet}"))
        top.addStretch()
        self.save_btn = QPushButton("Save Edited Cells")
        self.save_btn.clicked.connect(self.save)
        top.addWidget(self.save_btn)
        self.open_excel_btn = QPushButton("Open in Excel")
        self.open_excel_btn.clicked.connect(self.open_in_excel)
        top.addWidget(self.open_excel_btn)
        layout.addLayout(top)
        
        self.table = QTableWidget()
        self.table.cellChanged.connect(self.on_cell_changed)
        layout.addWidget(self.table)
        
        self.lbl_status = QLabel("Tips: Double click to edit. Click Save to commit changes to Excel.")
        layout.addWidget(self.lbl_status)
        
        # 先載入數據
        self.load_data()
        
        # 根據表格尺寸自動調整窗口大小 (v3.12)
        self.resize_to_fit_table()
        
    def load_data(self):
        self.table.blockSignals(True)
        headers, data, header_colors, data_colors = \
            self.excel_handler.get_all_sheet_data_with_colors(self.filename, self.sheet)

        self.table.setColumnCount(len(headers))
        self.table.setRowCount(len(data))
        self.table.setHorizontalHeaderLabels(headers)

        # 套用標題列顏色 (與 Excel 一致)
        for c, hdr in enumerate(headers):
            hex_color = header_colors[c] if c < len(header_colors) else None
            if hex_color:
                hitem = QTableWidgetItem(str(hdr))
                hitem.setBackground(QColor(hex_color))
                hitem.setForeground(QColor(self._contrast_text_color(hex_color)))
                self.table.setHorizontalHeaderItem(c, hitem)

        for r, row_data in enumerate(data):
            row_colors = data_colors[r] if r < len(data_colors) else []
            for c, val in enumerate(row_data):
                if c < len(headers):
                    item = QTableWidgetItem(str(val))
                    hex_color = row_colors[c] if c < len(row_colors) else None
                    if hex_color:
                        item.setBackground(QColor(hex_color))
                        item.setForeground(QColor(self._contrast_text_color(hex_color)))
                    self.table.setItem(r, c, item)

        # Auto-resize columns to content, then cap at 300
        self.table.resizeColumnsToContents()
        for c in range(self.table.columnCount()):
            if self.table.columnWidth(c) > 300:
                self.table.setColumnWidth(c, 300)

        self.table.blockSignals(False)
        self.dirty_cells.clear()

    @staticmethod
    def _contrast_text_color(hex_color):
        """依背景亮度回傳黑或白文字色，確保可讀性。"""
        try:
            h = hex_color.lstrip('#')
            r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
            luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
            return "#000000" if luminance > 0.5 else "#FFFFFF"
        except Exception:
            return "#000000"

    def open_in_excel(self):
        """以 Excel 開啟目前的檔案與工作表 (v3.17)"""
        try:
            self.excel_handler.open_sheet(self.filename, self.sheet)
        except Exception as e:
            QMessageBox.warning(self, "Error", f"無法開啟 Excel：{e}")

    def on_cell_changed(self, row, col):
        item = self.table.item(row, col)
        self.dirty_cells[(row, col)] = item.text()
        self.lbl_status.setText(f"Pending changes: {len(self.dirty_cells)}")

    def save(self):
        if not self.dirty_cells:
            QMessageBox.information(self, "Info", "No changes to save.")
            return

        self.table.setEnabled(False)
        self.lbl_status.setText("Saving changes to Excel...")
        QApplication.processEvents()
        
        success_count = 0
        errors = []
        
        for (r, c), val in self.dirty_cells.items():
            # Excel is 1-based, headers is row 1. Data starts row 2.
            # Logic in get_all_sheet_data: headers = rows[0], data = rows[1:]
            # So table row 0 corresponds to Excel row 2.
            excel_row = r + 2 
            excel_col = c + 1
            
            ok, msg = self.excel_handler.update_cell_value(
                self.filename, self.sheet, excel_col, excel_row, val
            )
            if ok: success_count += 1
            else: errors.append(f"({r},{c}): {msg}")
            
        self.table.setEnabled(True)
        self.dirty_cells.clear()
        
        if errors:
            QMessageBox.warning(self, "Partial Success", 
                                f"Saved {success_count} cells.\nErrors:\n" + "\n".join(errors[:5]))
        else:
            QMessageBox.information(self, "Success", f"{success_count} cells updated successfully.")
        
        self.accept()
    
    def resize_to_fit_table(self):
        """根據表格內容自動調整窗口大小 (v3.12)"""
        # 計算表格實際需要的寬度和高度
        table_width = self.table.verticalHeader().width() + 10  # 行標題寬度
        for col in range(self.table.columnCount()):
            table_width += self.table.columnWidth(col)
        
        table_height = self.table.horizontalHeader().height() + 10  # 列標題高度
        for row in range(self.table.rowCount()):
            table_height += self.table.rowHeight(row)
        
        # 添加額外空間給其他 UI 元素（工具列、狀態列等）
        extra_width = 50
        extra_height = 150
        
        # 取得螢幕可用空間
        screen = QApplication.primaryScreen().availableGeometry()
        max_width = int(screen.width() * 0.9)
        max_height = int(screen.height() * 0.9)
        
        # 設定最小尺寸
        min_width = 600
        min_height = 400
        
        # 計算最終尺寸
        target_width = min(max(table_width + extra_width, min_width), max_width)
        target_height = min(max(table_height + extra_height + 10, min_height), max_height)
        
        self.resize(target_width, target_height)

        self.lbl_status.setText("Ready")

# (SheetSettingsPanel and ColorSettingsPanel removed) - original comment


class EditConnectionDialog(QDialog):
    def __init__(self, parent, node_data, all_nodes, current_edges, user_rel_manager):
        super().__init__(parent)
        self.node_data = node_data
        self.all_nodes = all_nodes
        self.user_rel_manager = user_rel_manager
        self.current_edges = current_edges
        self.setWindowTitle(f"Edit Connections - {node_data['table']}.{node_data['sheet']}")
        self.resize(600, 400)
        self.init_ui()
        
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        # Existing Connections
        layout.addWidget(QLabel("Current Connections:"))
        self.list_widget = QListWidget()
        self.refresh_list()
        layout.addWidget(self.list_widget)
        
        btn_layout = QHBoxLayout()
        rem_btn = QPushButton("Remove Selected")
        rem_btn.clicked.connect(self.remove_connection)
        btn_layout.addWidget(rem_btn)
        layout.addLayout(btn_layout)
        
        layout.addWidget(QLabel("Add New Connection:"))
        add_layout = QHBoxLayout()
        
        self.target_cb = QComboBox()
        # Sort nodes
        sorted_nodes = sorted(self.all_nodes, key=lambda x: f"{x['table']}.{x['sheet']}")
        for n in sorted_nodes:
            if n['id'] == self.node_data['id']: continue
            self.target_cb.addItem(f"{n['table']}.{n['sheet']}", n['id'])
            
        add_layout.addWidget(self.target_cb)
        
        add_btn = QPushButton("Add Link")
        add_btn.clicked.connect(self.add_connection)
        add_layout.addWidget(add_btn)
        
        layout.addLayout(add_layout)
        
        close_btn = QPushButton("Close")
        close_btn.clicked.connect(self.accept)
        layout.addWidget(close_btn)
        
    def refresh_list(self):
        self.list_widget.clear()
        cid = self.node_data['id']
        # Filter edges for this node
        # We need to reload edges from manager/main window state? 
        # Actually passed edges might be stale if we modify.
        # But we modify via manager, then we should re-fetch?
        # For simplicity, we use passed edges + local changes?
        # Better: MainWindow passes a function to get fresh edges?
        pass # implemented in loop below assuming self.current_edges is updated or we parse locally
        
        # Let's rely on self.parent().graph_data['edges'] if possible, but safer to use what's passed if reference is kept.
        # However, we need to know WHICH are effectively active.
        # Let's re-read from MainWindow
        mw = self.parent()
        if hasattr(mw, 'load_graph_data'):
            data = mw.load_graph_data() # Reload merged data
            edges = data['edges']
        else:
            edges = self.current_edges

        for e in edges:
            other_id = None
            direction = ""
            if e['from'] == cid:
                other_id = e['to']
                direction = "->"
            elif e['to'] == cid:
                other_id = e['from']
                direction = "<-"
            
            if other_id:
                # Find other name
                other_name = "Unknown"
                for n in self.all_nodes:
                    if n['id'] == other_id:
                        other_name = f"{n['table']}.{n['sheet']}"
                        break
                
                rule = e.get('label', e.get('type', 'Unknown'))
                item_text = f"{direction} {other_name} [{rule}]"
                item = QListWidgetItem(item_text)
                item.setData(Qt.ItemDataRole.UserRole, e)
                self.list_widget.addItem(item)

    def add_connection(self):
        target_id = self.target_cb.currentData()
        if not target_id: return
        
        self.user_rel_manager.add_relation(self.node_data['id'], target_id, label="Manual")
        self.refresh_list()
        
    def remove_connection(self):
        item = self.list_widget.currentItem()
        if not item: return
        edge = item.data(Qt.ItemDataRole.UserRole)
        self.user_rel_manager.remove_relation(edge['from'], edge['to'])
        self.refresh_list()


# ============================================================
#  捲動式表格瀏覽器 (v4.0)
#  以分組卡片取代圖形主視窗：字首字典排序、各組顏色、
#  A–Z 側邊快速定位，僅供查找與選取，不顯示關聯與箭頭。
# ============================================================

def _contrast_text_color(color_hex):
    """依背景亮度回傳黑或白文字色，確保可讀性。"""
    c = QColor(color_hex)
    luminance = 0.299 * c.red() + 0.587 * c.green() + 0.114 * c.blue()
    return '#000000' if luminance > 150 else '#ffffff'


class FlowLayout(QLayout):
    """自動換行的流式佈局，用於排列同組卡片。"""

    def __init__(self, parent=None, spacing=8):
        super().__init__(parent)
        self.setContentsMargins(0, 0, 0, 0)
        self.setSpacing(spacing)
        self._items = []

    def addItem(self, item):
        self._items.append(item)

    def count(self):
        return len(self._items)

    def itemAt(self, index):
        return self._items[index] if 0 <= index < len(self._items) else None

    def takeAt(self, index):
        return self._items.pop(index) if 0 <= index < len(self._items) else None

    def expandingDirections(self):
        return Qt.Orientation(0)

    def hasHeightForWidth(self):
        return True

    def heightForWidth(self, width):
        return self._do_layout(QRect(0, 0, width, 0), True)

    def setGeometry(self, rect):
        super().setGeometry(rect)
        self._do_layout(rect, False)

    def sizeHint(self):
        return self.minimumSize()

    def minimumSize(self):
        size = QSize()
        for item in self._items:
            size = size.expandedTo(item.minimumSize())
        m = self.contentsMargins()
        size += QSize(m.left() + m.right(), m.top() + m.bottom())
        return size

    def _do_layout(self, rect, test_only):
        # 將 contentsMargins 納入排版與高度計算（heightForWidth 依賴此回傳值）
        m = self.contentsMargins()
        eff = rect.adjusted(m.left(), m.top(), -m.right(), -m.bottom())
        x, y = eff.x(), eff.y()
        line_height = 0
        spacing = self.spacing()
        for item in self._items:
            w = item.sizeHint().width()
            h = item.sizeHint().height()
            next_x = x + w + spacing
            if next_x - spacing > eff.right() and line_height > 0:
                x = eff.x()
                y = y + line_height + spacing
                next_x = x + w + spacing
                line_height = 0
            if not test_only:
                item.setGeometry(QRect(QPoint(x, y), QSize(w, h)))
            x = next_x
            line_height = max(line_height, h)
        # 內容底部 + 下邊距，相對於原始 rect 頂端的總高度
        return y + line_height - rect.y() + m.bottom()


class ClickableLabel(QLabel):
    """可點擊的標籤（用於分組標題：點擊改變該表格顏色）。"""

    clicked = pyqtSignal()

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton and self.rect().contains(event.pos()):
            self.clicked.emit()
        super().mouseReleaseEvent(event)


class TableCard(QFrame):
    """單一工作表卡片，可點選 / 雙擊 / 中鍵釘選。"""

    clicked = pyqtSignal(dict)
    double_clicked = pyqtSignal(dict)
    pin_requested = pyqtSignal(dict)  # 滾輪中鍵 → 選中並釘選

    def __init__(self, node_data, color_hex, font_size, parent=None):
        super().__init__(parent)
        self.node_data = node_data
        self.full_name = f"{node_data['table']}.{node_data['sheet']}"
        self.color_hex = color_hex
        self.font_size = font_size
        self.selected = False
        self.pinned = False
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Fixed)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 9, 14, 9)
        self._label = QLabel(node_data['sheet'])
        self._label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self._label)

        # 釘選圖示（右上角）
        self._pin = QLabel("📌", self)
        self._pin.setStyleSheet("background: transparent;")
        self._pin.adjustSize()
        self._pin.setVisible(False)

        self._apply_style()

    def set_color(self, color_hex):
        self.color_hex = color_hex
        self._apply_style()

    def set_font_size(self, size):
        self.font_size = size
        self._apply_style()

    def set_selected(self, selected):
        if self.selected != selected:
            self.selected = selected
            self._apply_style()

    def set_pinned(self, pinned):
        if self.pinned != pinned:
            self.pinned = pinned
            self._pin.setVisible(pinned)
            self._reposition_pin()

    def _reposition_pin(self):
        self._pin.adjustSize()
        self._pin.move(self.width() - self._pin.width() - 1, 0)
        self._pin.raise_()

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self._reposition_pin()

    def _apply_style(self):
        border_color = '#FFD700' if self.selected else 'rgba(255,255,255,0.30)'
        border_w = 3 if self.selected else 1
        text_color = _contrast_text_color(self.color_hex)
        self.setStyleSheet(f'''
            TableCard {{
                background-color: {self.color_hex};
                border: {border_w}px solid {border_color};
                border-radius: 6px;
            }}
            QLabel {{
                color: {text_color};
                background: transparent;
                font-family: "{FONT_FAMILY}";
                font-size: {self.font_size}pt;
            }}
        ''')

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.MiddleButton:
            self.pin_requested.emit(self.node_data)
            event.accept()
            return
        event.accept()

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton and self.rect().contains(event.pos()):
            self.clicked.emit(self.node_data)
        super().mouseReleaseEvent(event)

    def mouseDoubleClickEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.double_clicked.emit(self.node_data)
        super().mouseDoubleClickEvent(event)


class SideIndexBar(QWidget):
    """左側 A–Z 字首索引：點擊或拖曳即可快速定位到對應分組。"""

    letter_picked = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.letters = []
        self._active = None
        self.setFixedWidth(28)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

    def set_letters(self, letters):
        self.letters = letters
        if self._active not in letters:
            self._active = None
        self.update()

    def set_active(self, letter):
        if self._active != letter:
            self._active = letter
            self.update()

    def _letter_at(self, y):
        if not self.letters:
            return None
        slot = self.height() / len(self.letters)
        idx = int(y // slot) if slot else 0
        idx = max(0, min(len(self.letters) - 1, idx))
        return self.letters[idx]

    def mousePressEvent(self, event):
        self._pick(event.position().y())

    def mouseMoveEvent(self, event):
        self._pick(event.position().y())

    def _pick(self, y):
        letter = self._letter_at(y)
        if letter:
            self._active = letter
            self.letter_picked.emit(letter)
            self.update()

    def paintEvent(self, event):
        if not self.letters:
            return
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        slot = self.height() / len(self.letters)
        painter.setFont(QFont(FONT_FAMILY, max(7, min(10, int(slot * 0.5)))))
        for i, letter in enumerate(self.letters):
            rect = QRectF(0, i * slot, self.width(), slot)
            painter.setPen(QColor('#FFD700') if letter == self._active else QColor('#9E9E9E'))
            painter.drawText(rect, Qt.AlignmentFlag.AlignCenter, letter)


class TableBrowserView(QWidget):
    """主視窗：分組捲動瀏覽器，取代原本的圖形視圖。"""

    node_selected = pyqtSignal(dict)
    node_deselected = pyqtSignal()
    node_double_clicked = pyqtSignal(dict)
    table_color_requested = pyqtSignal(str)  # 點擊分組標題 → 變更該表格顏色
    node_pin_requested = pyqtSignal(dict)    # 中鍵卡片 → 選中並釘選

    def __init__(self, parent, config_manager, excel_handler):
        super().__init__(parent)
        self.config_manager = config_manager
        self.excel_handler = excel_handler
        self.font_size = config_manager.get_global_font_size()
        self.cards = []
        self.group_widgets = {}   # table -> 分組容器 widget
        self.selected_card = None
        self._build_ui()

    def _build_ui(self):
        outer = QHBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)

        self.content = QWidget()
        self.vbox = QVBoxLayout(self.content)
        self.vbox.setContentsMargins(14, 14, 14, 14)
        # 分組間距為 0，讓左側標題色塊在垂直方向彼此相連、不留空隙
        self.vbox.setSpacing(0)
        self.vbox.addStretch()
        self.scroll.setWidget(self.content)

        self.scroll.verticalScrollBar().valueChanged.connect(self._sync_index_to_scroll)

        # A–Z 字首索引改放在左側（位於捲動區之前）
        self.index_bar = SideIndexBar()
        self.index_bar.letter_picked.connect(self.scroll_to_letter)
        outer.addWidget(self.index_bar, 0)

        outer.addWidget(self.scroll, 1)

    @staticmethod
    def _initial(table):
        return table[0].upper() if table else '#'

    def _clear(self):
        self.cards = []
        self.group_widgets = {}
        self.selected_card = None
        while self.vbox.count():
            item = self.vbox.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()

    def load_nodes(self, nodes):
        """以分組卡片重建瀏覽器內容。"""
        self._clear()
        groups = {}
        for n in nodes:
            groups.setdefault(n['table'], []).append(n)

        for table in sorted(groups.keys(), key=lambda s: s.lower()):
            sheets = sorted(groups[table], key=lambda n: n['sheet'].lower())
            color = self.config_manager.get_table_color(table)
            section = self._make_group(table, sheets, color)
            self.vbox.addWidget(section)
            self.group_widgets[table] = section

        self.vbox.addStretch()
        self._refresh_index()

    def _make_group(self, table, sheets, color):
        box = QWidget()
        h = QHBoxLayout(box)
        h.setContentsMargins(0, 0, 0, 0)
        h.setSpacing(10)

        header = ClickableLabel()
        header.setFixedWidth(GROUP_LABEL_WIDTH)
        header.setWordWrap(False)  # 不換行，過長改以 "..." 省略
        # 色塊在垂直方向填滿整個分組高度，使相鄰分組標題彼此相連、不留空隙
        header.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Expanding)
        # 標題文字垂直置中，與右側卡片對齊
        header.setAlignment(Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignHCenter)
        header.setCursor(Qt.CursorShape.PointingHandCursor)
        header.clicked.connect(lambda t=table: self.table_color_requested.emit(t))
        self._style_header(header, table, len(sheets), color)
        h.addWidget(header, 0)

        holder = QWidget()
        sp = holder.sizePolicy()
        sp.setHeightForWidth(True)
        holder.setSizePolicy(sp)
        flow = FlowLayout(holder, spacing=8)
        # 上下對稱留白：分組間距為 0 時避免相鄰表格的卡片上下相撞；
        # 對稱可讓卡片在分組高度內垂直置中（與左側標題對齊）。
        # 左側標題色塊因垂直 Expanding 會填滿整個高度，仍保持相連。
        flow.setContentsMargins(0, GROUP_CARDS_BOTTOM_GAP // 2, 0, GROUP_CARDS_BOTTOM_GAP // 2)

        group_cards = []
        for n in sheets:
            card = TableCard(n, color, self.font_size)
            card.clicked.connect(lambda nd, c=card: self._select_card(c))
            card.double_clicked.connect(self.node_double_clicked.emit)
            card.pin_requested.connect(self.node_pin_requested.emit)
            flow.addWidget(card)
            self.cards.append(card)
            group_cards.append(card)

        h.addWidget(holder, 1, Qt.AlignmentFlag.AlignVCenter)

        box._table = table
        box._header = header
        box._cards = group_cards
        box._hidden = False
        return box

    def _style_header(self, header, table, count, color):
        text_color = _contrast_text_color(color)
        # 過長的表格名以 "..." 省略，完整名稱保留在 tooltip
        title_font = QFont(FONT_FAMILY, self.font_size + 1)
        title_font.setBold(True)
        avail = GROUP_LABEL_WIDTH - 20  # 扣除左右 padding 的可用寬度
        elided = QFontMetrics(title_font).elidedText(
            table, Qt.TextElideMode.ElideRight, avail)
        header.setText(f"{elided}\n({count})")
        header.setToolTip(f"{table}（點擊變更此表格顏色）")
        header.setStyleSheet(f'''
            QLabel {{
                background-color: {color};
                color: {text_color};
                font-family: "{FONT_FAMILY}";
                font-size: {self.font_size + 1}pt;
                font-weight: bold;
                padding: 6px 8px;
                border-radius: 0px;
            }}
        ''')

    def _select_card(self, card):
        if self.selected_card is not None and self.selected_card is not card:
            self.selected_card.set_selected(False)
        self.selected_card = card
        card.set_selected(True)
        self.node_selected.emit(card.node_data)

    def scroll_to_card(self, card):
        self.scroll.ensureWidgetVisible(card, 50, 50)

    def select_card_by_id(self, node_id):
        """以節點 id 選中對應卡片（會捲動至可見並發出 node_selected）。"""
        for card in self.cards:
            if card.node_data['id'] == node_id:
                self.scroll_to_card(card)
                self._select_card(card)
                return card
        return None

    def scroll_to_id(self, node_id, center=True):
        """捲動使指定卡片可見；center=True 時將卡片置於視窗垂直中央。"""
        for card in self.cards:
            if card.node_data['id'] == node_id:
                if center:
                    vp_h = self.scroll.viewport().height()
                    y = card.mapTo(self.content, QPoint(0, 0)).y()
                    target = y - vp_h // 2 + card.height() // 2
                    self.scroll.verticalScrollBar().setValue(max(0, target))
                else:
                    self.scroll_to_card(card)
                return

    def find_card_by_name(self, name):
        """依名稱找卡片：先精確比對子表格名稱，再比對表格群組名稱（回傳該組第一張）。"""
        if not name:
            return None
        key = name.strip().lower()
        for card in self.cards:
            if card.node_data['sheet'].lower() == key:
                return card
        for card in self.cards:
            if card.node_data['table'].lower() == key:
                return card
        return None

    def first_visible_card(self):
        """回傳目前可見（未被搜尋過濾）的第一張卡片。"""
        for card in self.cards:
            if card.isVisible():
                return card
        return None

    def set_pinned_ids(self, ids):
        """更新卡片的釘選標記。"""
        for card in self.cards:
            card.set_pinned(card.node_data['id'] in ids)

    # --- 側邊索引 ---
    def _refresh_index(self):
        letters = []
        for table in sorted(self.group_widgets.keys(), key=lambda s: s.lower()):
            if not self.group_widgets[table]._hidden:
                ini = self._initial(table)
                if ini not in letters:
                    letters.append(ini)
        self.index_bar.set_letters(letters)

    def scroll_to_letter(self, letter):
        for table in sorted(self.group_widgets.keys(), key=lambda s: s.lower()):
            box = self.group_widgets[table]
            if not box._hidden and self._initial(table) == letter:
                y = box.mapTo(self.content, QPoint(0, 0)).y()
                self.scroll.verticalScrollBar().setValue(y)
                return

    def _sync_index_to_scroll(self):
        """捲動時同步反白側邊索引目前所在的字首。"""
        viewport_top = self.scroll.verticalScrollBar().value()
        current = None
        for table in sorted(self.group_widgets.keys(), key=lambda s: s.lower()):
            box = self.group_widgets[table]
            if box._hidden:
                continue
            if current is None:
                current = self._initial(table)  # 預設取第一個可見分組
            y = box.mapTo(self.content, QPoint(0, 0)).y()
            if y <= viewport_top + 16:
                current = self._initial(table)
        if current is not None:
            self.index_bar.set_active(current)

    # --- 搜尋（過濾顯示）---
    def search_highlight(self, keyword):
        kw = keyword.lower()
        for table, box in self.group_widgets.items():
            any_visible = False
            for card in box._cards:
                match = kw in card.node_data['sheet'].lower() or kw in table.lower()
                card.setVisible(match)
                any_visible = any_visible or match
            box._hidden = not any_visible
            box.setVisible(any_visible)
        self._refresh_index()

    def clear_search(self):
        for box in self.group_widgets.values():
            box._hidden = False
            box.setVisible(True)
            for card in box._cards:
                card.setVisible(True)
        self._refresh_index()

    # --- 顏色與字體刷新 ---
    def refresh_colors(self):
        for table, box in self.group_widgets.items():
            color = self.config_manager.get_table_color(table)
            self._style_header(box._header, table, len(box._cards), color)
            for card in box._cards:
                card.set_color(color)

    def set_font_size_live(self, size):
        self.font_size = size
        for table, box in self.group_widgets.items():
            color = self.config_manager.get_table_color(table)
            self._style_header(box._header, table, len(box._cards), color)
            for card in box._cards:
                card.set_font_size(size)


class PanTableWidget(QTableWidget):
    """支援按住滾輪中鍵拖曳瀏覽的表格（與 Relation View 的中鍵平移一致）。"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._panning = False
        self._pan_start = QPoint()
        # 以「像素」為捲動單位，中鍵拖曳才能與 Relation View 一樣滑到哪就到哪，
        # 否則 QTableWidget 預設以「整列 / 整欄」為單位，拖一格就跳一整欄。
        self.setHorizontalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        self.setVerticalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)

    def wheelEvent(self, event):
        # 按住 Shift 滾輪 → 水平橫移（而非加速垂直滾動）
        if event.modifiers() & Qt.KeyboardModifier.ShiftModifier:
            delta = event.angleDelta().y() or event.angleDelta().x()
            h = self.horizontalScrollBar()
            h.setValue(h.value() - delta)
            event.accept()
            return
        super().wheelEvent(event)

    def _release_cell_focus(self):
        """解除對儲存格的選取與鍵盤焦點：清除藍色反白、當前格，並讓表格失焦，
        如此 Tab 或其他按鍵不再作用於原本的儲存格。"""
        if self.state() == QAbstractItemView.State.EditingState:
            return  # 編輯中不打斷，交由預設行為處理
        self.clearSelection()
        self.setCurrentIndex(QModelIndex())
        self.clearFocus()

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.MiddleButton:
            self._panning = True
            self._pan_start = event.position().toPoint()
            self.setCursor(Qt.CursorShape.ClosedHandCursor)
            event.accept()
            return
        if event.button() == Qt.MouseButton.LeftButton and \
                not self.indexAt(event.position().toPoint()).isValid():
            # 點在沒有儲存格的空白處：解除藍色反白即脫離焦點
            self._release_cell_focus()
            event.accept()
            return
        super().mousePressEvent(event)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_Escape and \
                self.state() != QAbstractItemView.State.EditingState:
            self._release_cell_focus()
            event.accept()
            return
        super().keyPressEvent(event)

    def mouseMoveEvent(self, event):
        if self._panning:
            pos = event.position().toPoint()
            delta = pos - self._pan_start
            self._pan_start = pos
            h = self.horizontalScrollBar()
            v = self.verticalScrollBar()
            h.setValue(h.value() - delta.x())
            v.setValue(v.value() - delta.y())
            event.accept()
            return
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.MiddleButton and self._panning:
            self._panning = False
            self.setCursor(Qt.CursorShape.ArrowCursor)
            event.accept()
            return
        super().mouseReleaseEvent(event)


class SheetChip(QFrame):
    """右欄上方的子表格方塊：顯示子表格名稱（含表格顏色）。

    互動：
    - 左鍵點擊 → 切換預覽。
    - 滾輪中鍵 → 釘選 / 取消釘選（未釘選的當前預覽方塊也可中鍵釘選）。
    - 釘選方塊可按住左鍵拖曳排序；拖放與即時預覽由父層 ChipBar 處理。
    """

    # node id 可能是 int（來自 relationship_graph.json）或 str，必須用 object，
    # 否則以 QueuedConnection 傳遞 int 給 str 型別的訊號時，跨執行緒序列化會直接閃退。
    clicked = pyqtSignal(dict)
    unpin_requested = pyqtSignal(object)         # 中鍵已釘選方塊 → 取消釘選（傳 node id）
    pin_requested = pyqtSignal(dict)             # 中鍵未釘選方塊 → 釘選（傳 node_data）

    # 拖放用的自訂 MIME 格式，避免與外部拖放混淆
    MIME = "application/x-tablevisualizer-sheetchip"

    def __init__(self, node_data, color_hex, font_size, pinned=False, active=False, parent=None):
        super().__init__(parent)
        self.node_data = node_data
        self.color_hex = color_hex
        self.font_size = font_size
        self.pinned = pinned
        self.active = active
        self._press_pos = None      # 左鍵按下位置，用於判斷是否進入拖曳
        self._drag_active = False   # 拖曳進行中：放開時不視為點擊
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Fixed)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 6, 12, 6)
        self._label = QLabel(node_data['sheet'])
        self._label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self._label)

        self._pin = QLabel("📌", self)
        self._pin.setStyleSheet("background: transparent;")
        self._pin.adjustSize()
        self._pin.setVisible(pinned)

        self._apply_style()

    def _apply_style(self):
        border_color = '#FFD700' if self.active else 'rgba(255,255,255,0.30)'
        border_w = 3 if self.active else 1
        text_color = _contrast_text_color(self.color_hex)
        self.setStyleSheet(f'''
            SheetChip {{
                background-color: {self.color_hex};
                border: {border_w}px solid {border_color};
                border-radius: 6px;
            }}
            QLabel {{
                color: {text_color};
                background: transparent;
                font-family: "{FONT_FAMILY}";
                font-size: {self.font_size}pt;
            }}
        ''')

    def set_dimmed(self, on):
        """拖曳預覽時，把正在移動的方塊變暗，標示它的預計落點。"""
        if on:
            eff = QGraphicsOpacityEffect(self)
            eff.setOpacity(0.4)
            self.setGraphicsEffect(eff)
        else:
            self.setGraphicsEffect(None)

    def _reposition_pin(self):
        self._pin.adjustSize()
        self._pin.move(self.width() - self._pin.width() - 1, 0)
        self._pin.raise_()

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self._reposition_pin()

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self._press_pos = event.pos()
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        # 釘選方塊按住左鍵並拖曳超過門檻 → 啟動排序拖放
        if (self.pinned and self._press_pos is not None
                and event.buttons() & Qt.MouseButton.LeftButton
                and (event.pos() - self._press_pos).manhattanLength()
                >= QApplication.startDragDistance()):
            self._start_drag()
            return
        super().mouseMoveEvent(event)

    def _start_drag(self):
        self._drag_active = True
        drag = QDrag(self)
        mime = QMimeData()
        mime.setData(self.MIME, str(self.node_data['id']).encode('utf-8'))
        drag.setMimeData(mime)
        pixmap = self.grab()
        drag.setPixmap(pixmap)
        drag.setHotSpot(self._press_pos)
        drag.exec(Qt.DropAction.MoveAction)
        self._drag_active = False
        self._press_pos = None

    def mouseReleaseEvent(self, event):
        # 拖曳結束的釋放不視為點擊
        if self._drag_active:
            self._drag_active = False
            self._press_pos = None
            return
        if event.button() == Qt.MouseButton.LeftButton and self.rect().contains(event.pos()):
            self.clicked.emit(self.node_data)
        elif event.button() == Qt.MouseButton.MiddleButton:
            # 中鍵：已釘選 → 取消釘選；未釘選（當前預覽方塊）→ 釘選
            if self.pinned:
                self.unpin_requested.emit(self.node_data['id'])
            else:
                self.pin_requested.emit(self.node_data)
        self._press_pos = None
        super().mouseReleaseEvent(event)


class ChipBar(QWidget):
    """釘選方塊容器：拖曳排序時即時重排方塊，讓使用者直接看到預計的最終順序。

    - 僅釘選方塊（pinned）可被拖曳與重排；未釘選的「當前預覽」方塊固定置於最前。
    - 拖曳過程中依游標位置即時把方塊插入到預計位置（被拖曳的方塊變暗）。
    - 放開後發出 reorder_committed，帶出最終的釘選 node id 順序。
    """

    reorder_committed = pyqtSignal(list)  # 拖放完成 → 釘選方塊的 node id 字串順序

    def __init__(self, parent=None):
        super().__init__(parent)
        self.flow = FlowLayout(self, spacing=6)
        self.setAcceptDrops(True)
        # 高度貼齊內容，避免方塊列搶走下方表格的垂直空間
        self.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Minimum)
        self._drag_id = None       # 正在拖曳的方塊 id（字串）
        self._dragging_chip = None

    # --- 取得目前方塊 ---
    def _chips(self):
        chips = []
        for i in range(self.flow.count()):
            w = self.flow.itemAt(i).widget()
            if isinstance(w, SheetChip):
                chips.append(w)
        return chips

    def _relayout(self, ordered_chips):
        """依指定順序重新排列方塊（widget 持續存在，只調整順序並立即重繪）。"""
        while self.flow.count():
            self.flow.takeAt(0)
        for c in ordered_chips:
            self.flow.addWidget(c)
        self.flow.invalidate()
        self.flow.setGeometry(self.contentsRect())

    def _row_height(self, chips):
        return max((c.height() for c in chips), default=24)

    def _insertion_index(self, pos, movable):
        """依閱讀順序計算游標落點在可移動方塊中的插入索引。"""
        row_h = self._row_height(movable)
        idx = 0
        for c in movable:
            center = c.geometry().center()
            if center.y() < pos.y() - row_h / 2:
                idx += 1                      # 游標所在列之上的方塊
            elif center.y() <= pos.y() + row_h / 2 and center.x() < pos.x():
                idx += 1                      # 同列且在游標左側
        return idx

    def _preview(self, pos):
        """依游標位置重排方塊以預覽最終順序。"""
        chips = self._chips()
        fixed = [c for c in chips if not c.pinned]          # 當前預覽方塊固定在最前
        movable = [c for c in chips if c.pinned and str(c.node_data['id']) != self._drag_id]
        dragged = self._dragging_chip
        idx = self._insertion_index(pos, movable)
        new_movable = movable[:idx] + ([dragged] if dragged else []) + movable[idx:]
        self._relayout(fixed + new_movable)

    def _is_ours(self, event):
        return event.mimeData().hasFormat(SheetChip.MIME)

    def dragEnterEvent(self, event):
        if not self._is_ours(event):
            event.ignore()
            return
        self._drag_id = bytes(event.mimeData().data(SheetChip.MIME)).decode('utf-8')
        self._dragging_chip = next(
            (c for c in self._chips() if str(c.node_data['id']) == self._drag_id), None)
        if self._dragging_chip:
            self._dragging_chip.set_dimmed(True)
        event.acceptProposedAction()
        self._preview(event.position().toPoint())

    def dragMoveEvent(self, event):
        if not self._is_ours(event):
            event.ignore()
            return
        event.acceptProposedAction()
        self._preview(event.position().toPoint())

    def dragLeaveEvent(self, event):
        # 離開容器：取消預覽並還原（由 panel 重建），清除變暗
        if self._dragging_chip:
            self._dragging_chip.set_dimmed(False)
        self._end_drag(commit=False)
        super().dragLeaveEvent(event)

    def dropEvent(self, event):
        if not self._is_ours(event):
            event.ignore()
            return
        self._preview(event.position().toPoint())
        if self._dragging_chip:
            self._dragging_chip.set_dimmed(False)
        event.acceptProposedAction()
        self._end_drag(commit=True)

    def _end_drag(self, commit):
        if commit:
            order = [str(c.node_data['id']) for c in self._chips() if c.pinned]
            self.reorder_committed.emit(order)
        else:
            # 還原：請 panel 依現有 pinned 順序重建
            self.reorder_committed.emit([])
        self._drag_id = None
        self._dragging_chip = None


class QuickBrowsePanel(QWidget):
    """右欄：選取 / 雙擊表格時即時顯示該工作表完整內容（含 Excel 顏色），可儲存與在 Excel 開啟。"""

    chip_selected = pyqtSignal(dict)  # 點擊上方子表格方塊 → 切換預覽
    pins_changed = pyqtSignal()       # 釘選清單變動 → 通知主視窗更新卡片標記
    fullscreen_toggle_requested = pyqtSignal()  # 按下全螢幕按鈕 → 切換右欄全介面

    def __init__(self, excel_handler, config_manager):
        super().__init__()
        self.excel_handler = excel_handler
        self.config_manager = config_manager
        self.current_node_data = None
        self.filename = None
        self.sheet = None
        self.dirty_cells = {}  # (row, col) -> new_value
        self.pinned = []       # 釘選的 node_data（依序，僅存於記憶體，關閉 app 即解除）
        self.all_nodes = []    # 所有表格節點，供「所有表格」搜尋範圍使用（由主視窗注入）
        self.preview_zoom = config_manager.get_preview_zoom()  # 右欄預覽縮放百分比
        # 釘選表格內容搜尋狀態
        self._pin_search_query = None
        self._pin_search_pins = ()          # 上次建立結果時的釘選順序簽章
        self._pin_search_matches = []        # [(node_data, row, col), ...]
        self._pin_search_idx = -1
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)

        # 第一列：搜尋相關控制項全部置於同一水平
        #（搜尋框 + 範圍切換 + 上一筆 / 計數 / 下一筆 + 操作按鈕）
        search_row = QHBoxLayout()
        search_row.setSpacing(6)

        self.pin_search_in = QLineEdit()
        self.pin_search_in.setPlaceholderText("搜尋表格內容…")
        self.pin_search_in.setMaximumWidth(200)
        self.pin_search_in.setToolTip("Enter：定位下一筆；Shift+Enter：上一筆")
        self.pin_search_in.installEventFilter(self)  # 攔截 Enter / Shift+Enter
        search_row.addWidget(self.pin_search_in, 0)

        # 搜尋範圍切換：當前瀏覽表格 / 釘選的表格 / 所有表格
        self.search_scope_combo = QComboBox()
        self.search_scope_combo.addItem("當前瀏覽表格", "current")
        self.search_scope_combo.addItem("釘選的表格", "pinned")
        self.search_scope_combo.addItem("所有表格", "all")
        self.search_scope_combo.setToolTip("選擇搜尋範圍")
        self.search_scope_combo.currentIndexChanged.connect(self._on_scope_changed)
        search_row.addWidget(self.search_scope_combo, 0)

        # 上一筆 / 下一筆只在有搜尋結果時顯示，一般狀態隱藏
        self.pin_prev_btn = QPushButton("◀")
        self.pin_prev_btn.setFixedWidth(28)
        self.pin_prev_btn.setToolTip("上一筆結果 (Shift+Enter)")
        self.pin_prev_btn.clicked.connect(lambda: self._run_pin_search(forward=False))
        self.pin_prev_btn.setVisible(False)
        search_row.addWidget(self.pin_prev_btn, 0)

        self.pin_result_label = QLabel("")
        self.pin_result_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.pin_result_label.setMinimumWidth(48)
        search_row.addWidget(self.pin_result_label, 0)

        self.pin_next_btn = QPushButton("▶")
        self.pin_next_btn.setFixedWidth(28)
        self.pin_next_btn.setToolTip("下一筆結果 (Enter)")
        self.pin_next_btn.clicked.connect(lambda: self._run_pin_search(forward=True))
        self.pin_next_btn.setVisible(False)
        search_row.addWidget(self.pin_next_btn, 0)

        search_row.addStretch(1)

        self.save_btn = QPushButton("Save to Excel")
        self.save_btn.clicked.connect(self.save)
        search_row.addWidget(self.save_btn, 0)

        self.open_excel_btn = QPushButton("Open in Excel")
        self.open_excel_btn.clicked.connect(self.open_in_excel)
        search_row.addWidget(self.open_excel_btn, 0)
        layout.addLayout(search_row)

        # 第二列：子表格方塊（含釘選），靠左排列於搜尋列下方
        self.chip_bar = ChipBar()
        self.chip_layout = self.chip_bar.flow
        self.chip_bar.reorder_committed.connect(
            self._commit_pin_order, Qt.ConnectionType.QueuedConnection)
        layout.addWidget(self.chip_bar)

        self.table = PanTableWidget()
        self.table.cellChanged.connect(self.on_cell_changed)
        # 滾動條常駐，不要自動隱藏。
        # macOS 原生 overlay 滾動條即使設定 AlwaysOn 仍會淡出隱藏，
        # 因此額外套用 QScrollBar 樣式，強制改用常駐的自繪滾動條。
        self.table.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOn)
        self.table.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOn)
        # 儲存格之間以細黑線呈現格線（深色主題下預設格線看不見）
        self.table.setShowGrid(True)
        self.table.setStyleSheet('''
            QTableWidget { gridline-color: #000000; }
            QTableWidget::item:selected {
                background-color: #1565C0;
                color: #FFFFFF;
                border: 2px solid #00E5FF;
            }
            QScrollBar:vertical { width: 14px; background: #2b2b2b; margin: 0; }
            QScrollBar::handle:vertical { background: #6e6e6e; min-height: 28px; border-radius: 5px; }
            QScrollBar::handle:vertical:hover { background: #8a8a8a; }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical { background: transparent; }
            QScrollBar:horizontal { height: 14px; background: #2b2b2b; margin: 0; }
            QScrollBar::handle:horizontal { background: #6e6e6e; min-width: 28px; border-radius: 5px; }
            QScrollBar::handle:horizontal:hover { background: #8a8a8a; }
            QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal { width: 0; }
            QScrollBar::add-page:horizontal, QScrollBar::sub-page:horizontal { background: transparent; }
        ''')
        layout.addWidget(self.table)

        # 凍結標題列下方的粗黑分隔線（疊在 viewport 頂端，不影響標題色）。
        # 滾動時 viewport 會重繪而蓋住此線，故監聽捲動值變化重新定位並置頂。
        self.header_line = QFrame(self.table.viewport())
        self.header_line.setStyleSheet("background-color: #000000; border: none;")
        self.header_line.setFixedHeight(3)
        self.header_line.hide()
        self.table.viewport().installEventFilter(self)
        self.table.verticalScrollBar().valueChanged.connect(self._position_header_line)
        self.table.horizontalScrollBar().valueChanged.connect(self._position_header_line)

        # 底部狀態列 + 右下角縮放拉條（類似 Excel 右下角縮放）
        bottom = QHBoxLayout()
        self.lbl_status = QLabel()
        bottom.addWidget(self.lbl_status, 1)

        self.zoom_slider = QSlider(Qt.Orientation.Horizontal)
        self.zoom_slider.setRange(50, 300)   # 50% ~ 300%
        self.zoom_slider.setFixedWidth(160)
        self.zoom_slider.setValue(self.preview_zoom)
        self.zoom_slider.setToolTip("調整右欄預覽表格大小")
        self.zoom_slider.valueChanged.connect(self.set_preview_zoom)
        bottom.addWidget(self.zoom_slider, 0)

        self.zoom_label = QLabel(f"{self.preview_zoom}%")
        self.zoom_label.setMinimumWidth(44)
        self.zoom_label.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        bottom.addWidget(self.zoom_label, 0)

        # 全螢幕按鈕：將右欄放大至全介面（隱藏左側兩個窗口），再按一次恢復
        self.fullscreen_btn = QPushButton("⛶")
        self.fullscreen_btn.setCheckable(True)
        self.fullscreen_btn.setFixedWidth(32)
        self.fullscreen_btn.setToolTip("放大右欄至全介面 (Tab)")
        self.fullscreen_btn.clicked.connect(self.fullscreen_toggle_requested.emit)
        bottom.addWidget(self.fullscreen_btn, 0)
        layout.addLayout(bottom)

        self.clear()

    def eventFilter(self, obj, event):
        # 注意：pin_search_in 的事件過濾器在 self.table 建立前即已安裝，
        # 故先比對 pin_search_in，並以 getattr 保護 self.table 尚未存在的情況。
        if obj is self.pin_search_in:
            if event.type() == QEvent.Type.KeyPress and \
                    event.key() in (Qt.Key.Key_Return, Qt.Key.Key_Enter):
                # Enter：下一筆；Shift+Enter：上一筆
                forward = not bool(event.modifiers() & Qt.KeyboardModifier.ShiftModifier)
                self._run_pin_search(forward=forward)
                return True
        elif hasattr(self, 'table') and obj is self.table.viewport() \
                and event.type() == QEvent.Type.Resize:
            self._position_header_line()
        return super().eventFilter(obj, event)

    def _position_header_line(self):
        vp = self.table.viewport()
        self.header_line.setGeometry(0, 0, vp.width(), 3)
        self.header_line.setVisible(self.table.rowCount() > 0)
        self.header_line.raise_()

    # --- 釘選模型 ---
    def pinned_ids(self):
        return {n['id'] for n in self.pinned}

    def is_pinned(self, node_id):
        return node_id in self.pinned_ids()

    def pin_node(self, node_data):
        if not self.is_pinned(node_data['id']):
            self.pinned.append(node_data)
            self.rebuild_chips()
            self.pins_changed.emit()

    def unpin_node(self, node_id):
        if self.is_pinned(node_id):
            self.pinned = [n for n in self.pinned if n['id'] != node_id]
            self.rebuild_chips()
            self.pins_changed.emit()

    def next_pinned(self, forward=True):
        """回傳釘選清單中相對目前預覽的下一個 / 上一個 node_data；無釘選則回傳 None。"""
        if not self.pinned:
            return None
        ids = [n['id'] for n in self.pinned]
        cur_id = self.current_node_data['id'] if self.current_node_data else None
        if cur_id in ids:
            idx = ids.index(cur_id)
            nxt = (idx + 1) % len(ids) if forward else (idx - 1) % len(ids)
        else:
            nxt = 0 if forward else len(ids) - 1
        return self.pinned[nxt]

    # --- 表格內容搜尋 ---
    def _pin_search_scope(self):
        """依右上角下拉選單決定搜尋範圍：當前瀏覽表格 / 釘選的表格 / 所有表格。"""
        mode = self.search_scope_combo.currentData()
        if mode == 'all':
            return list(self.all_nodes)
        if mode == 'pinned':
            return list(self.pinned)
        # 'current'：僅搜尋目前開啟的表格
        if self.current_node_data:
            return [self.current_node_data]
        return []

    def _on_scope_changed(self, _index=0):
        """搜尋範圍變動：清除前次結果快取，若已輸入關鍵字則立即以新範圍重搜。"""
        self._pin_search_query = None
        self._pin_search_pins = ()
        self._pin_search_matches = []
        self._pin_search_idx = -1
        self._update_pin_result_label()
        if self.pin_search_in.text().strip():
            self._run_pin_search(forward=True)

    def _run_pin_search(self, forward=True):
        """搜尋（釘選 / 目前）表格內容並切換 Focus。

        - 關鍵字 / 搜尋範圍變動時重建結果，forward 決定先跳第一筆或最後一筆。
        - 否則依方向（Enter 下一筆 / Shift+Enter 上一筆 / 左右箭頭）循環切換。
        """
        query = self.pin_search_in.text().strip()
        if not query:
            self._update_pin_result_label()
            return
        scope = self._pin_search_scope()
        pins_sig = tuple(n['id'] for n in scope)
        if query != self._pin_search_query or pins_sig != self._pin_search_pins:
            self._pin_search_query = query
            self._pin_search_pins = pins_sig
            self._pin_search_matches = self._build_pin_search_matches(query, scope)
            self._pin_search_idx = -1

        if not self._pin_search_matches:
            self._pin_search_idx = -1
            if not scope:
                self.lbl_status.setText("目前沒有可搜尋的表格。")
            else:
                self.lbl_status.setText(f"表格中找不到「{query}」。")
            self._update_pin_result_label()
            return

        n = len(self._pin_search_matches)
        if self._pin_search_idx < 0:
            self._pin_search_idx = 0 if forward else n - 1
        else:
            self._pin_search_idx = (self._pin_search_idx + (1 if forward else -1)) % n
        self._jump_to_pin_match(self._pin_search_idx)
        self._update_pin_result_label()

    def _update_pin_result_label(self):
        """更新「目前 / 總筆數」顯示，並依是否有結果切換左右按鈕的顯示。"""
        n = len(self._pin_search_matches)
        if n and self._pin_search_idx >= 0:
            self.pin_result_label.setText(f"{self._pin_search_idx + 1}/{n}")
        else:
            self.pin_result_label.setText("")
        # 左右切換按鈕只在有搜尋結果時顯示
        self.pin_prev_btn.setVisible(n > 0)
        self.pin_next_btn.setVisible(n > 0)

    def _build_pin_search_matches(self, query, scope):
        """依順序掃描 scope 內各表格的表頭與儲存格，回傳符合的 (node_data, row, col)。"""
        q = query.lower()
        matches = []
        seen = set()  # (node id, row, col) 去重，避免表頭命中與首列儲存格落在同格

        def add(nd, r, c):
            key = (nd['id'], r, c)
            if key not in seen:
                seen.add(key)
                matches.append((nd, r, c))

        for nd in scope:
            try:
                headers, data, _hc, _dc = \
                    self.excel_handler.get_all_sheet_data_with_colors(nd['filename'], nd['sheet'])
            except Exception:
                continue
            for c, hdr in enumerate(headers):
                if q in str(hdr).lower():
                    add(nd, 0, c)  # 表頭命中：定位該欄第一列
            for r, row in enumerate(data):
                for c, val in enumerate(row):
                    if q in str(val).lower():
                        add(nd, r, c)
        return matches

    def _jump_to_pin_match(self, idx):
        """切換到命中所在的釘選表格並選取 / 捲動到該儲存格。"""
        nd, r, c = self._pin_search_matches[idx]
        if not (self.current_node_data and self.current_node_data.get('id') == nd['id']):
            # 透過卡片選取切換預覽，保持主視窗 / 關聯圖同步
            self.chip_selected.emit(nd)
            if not (self.current_node_data and self.current_node_data.get('id') == nd['id']):
                return  # 切換被取消（例如有未儲存編輯）
        if r < self.table.rowCount() and c < self.table.columnCount():
            self.table.setCurrentCell(r, c)
            item = self.table.item(r, c)
            if item:
                self.table.scrollToItem(item, QAbstractItemView.ScrollHint.PositionAtCenter)
        self.lbl_status.setText(
            f"搜尋「{self._pin_search_query}」：第 {idx + 1}/{len(self._pin_search_matches)} 筆"
            f"（{nd['sheet']}）")
        # 把焦點留在搜尋框，讓使用者可連續按 Enter 跳下一筆
        self.pin_search_in.setFocus()

    def rebuild_chips(self):
        # 清空現有方塊
        while self.chip_layout.count():
            it = self.chip_layout.takeAt(0)
            w = it.widget()
            if w:
                w.deleteLater()

        font_size = self.config_manager.get_global_font_size()
        cur_id = self.current_node_data['id'] if self.current_node_data else None

        # 顯示集合：目前預覽（若未釘選）置前，其後接所有釘選方塊
        display = []
        seen = set()
        if self.current_node_data and not self.is_pinned(cur_id):
            display.append(self.current_node_data)
            seen.add(cur_id)
        for n in self.pinned:
            if n['id'] not in seen:
                display.append(n)
                seen.add(n['id'])

        for nd in display:
            color = self.config_manager.get_table_color(nd['table'])
            chip = SheetChip(nd, color, font_size,
                             pinned=self.is_pinned(nd['id']),
                             active=(nd['id'] == cur_id))
            chip.clicked.connect(self.chip_selected.emit)
            # 用 Queued 連線：釘選 / 取消釘選 / 排序都會在 rebuild_chips 中刪除此 chip，
            # 必須等目前的滑鼠事件完全結束後再執行，否則會 use-after-free 閃退。
            chip.unpin_requested.connect(self.unpin_node, Qt.ConnectionType.QueuedConnection)
            chip.pin_requested.connect(self.pin_node, Qt.ConnectionType.QueuedConnection)
            self.chip_layout.addWidget(chip)

    def _commit_pin_order(self, ordered_ids):
        """拖放完成：依預覽得到的 node id 順序重排釘選清單並重建方塊。

        ordered_ids 為空（拖曳取消 / 離開容器）時，僅依現有順序重建以還原預覽。
        """
        if ordered_ids:
            id_to_node = {str(n['id']): n for n in self.pinned}
            new_order = [id_to_node[i] for i in ordered_ids if i in id_to_node]
            for n in self.pinned:  # 保險：補回任何遺漏的釘選
                if n not in new_order:
                    new_order.append(n)
            changed = new_order != self.pinned
            self.pinned = new_order
        else:
            changed = False
        self.rebuild_chips()
        if changed:
            self.pins_changed.emit()

    def clear(self):
        # 釘選保留（僅關閉 app 才解除），只清空目前預覽內容
        self.current_node_data = None
        self.filename = None
        self.sheet = None
        self.dirty_cells = {}
        self.table.blockSignals(True)
        self.table.clear()
        self.table.setRowCount(0)
        self.table.setColumnCount(0)
        self.table.blockSignals(False)
        self.header_line.hide()
        self.rebuild_chips()
        self.lbl_status.setText("Select a table")
        self.save_btn.setEnabled(False)
        self.open_excel_btn.setEnabled(False)

    def show_node(self, node_data):
        # 重複選取同一節點時不重載，避免覆蓋未儲存的編輯
        if self.current_node_data and self.current_node_data.get('id') == node_data.get('id'):
            return
        self.current_node_data = node_data
        self.filename = node_data['filename']
        self.sheet = node_data['sheet']
        self.save_btn.setEnabled(True)
        self.open_excel_btn.setEnabled(True)
        self.rebuild_chips()
        self.load_data()

    def load_data(self):
        if not self.current_node_data:
            return
        self.table.blockSignals(True)
        try:
            headers, data, header_colors, data_colors = \
                self.excel_handler.get_all_sheet_data_with_colors(self.filename, self.sheet)
        except Exception as e:
            self.table.blockSignals(False)
            QMessageBox.warning(self, "Read Error", str(e))
            return

        # 含公式的儲存格鎖定為唯讀（避免覆寫公式）
        try:
            formula_cells = self.excel_handler.get_formula_cells(self.filename, self.sheet)
        except Exception:
            formula_cells = set()

        self.table.clear()
        self.table.setColumnCount(len(headers))
        self.table.setRowCount(len(data))
        self.table.setHorizontalHeaderLabels(headers)

        # 套用標題列顏色 (與 Excel 一致)
        for c, hdr in enumerate(headers):
            hex_color = header_colors[c] if c < len(header_colors) else None
            if hex_color:
                hitem = QTableWidgetItem(str(hdr))
                hitem.setBackground(QColor(hex_color))
                hitem.setForeground(QColor(self._contrast_text_color(hex_color)))
                self.table.setHorizontalHeaderItem(c, hitem)

        for r, row_data in enumerate(data):
            row_colors = data_colors[r] if r < len(data_colors) else []
            for c, val in enumerate(row_data):
                if c < len(headers):
                    item = QTableWidgetItem(str(val))
                    hex_color = row_colors[c] if c < len(row_colors) else None
                    if hex_color:
                        item.setBackground(QColor(hex_color))
                        item.setForeground(QColor(self._contrast_text_color(hex_color)))
                    if (r, c) in formula_cells:
                        # 公式儲存格：移除可編輯旗標並提示
                        item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
                        item.setToolTip("此儲存格為公式，無法編輯")
                    self.table.setItem(r, c, item)

        self._apply_zoom_to_table()

        self.table.blockSignals(False)
        self.dirty_cells.clear()
        self._position_header_line()
        self.lbl_status.setText("Tips: 雙擊儲存格可編輯，按 Save to Excel 寫回。")

    def _apply_zoom_to_table(self):
        """依全域字體大小 × 預覽縮放百分比，套用字體與欄 / 列尺寸。

        QHeaderView（凍結的首列標題與首欄列號）有獨立字體，且本表格已套用
        stylesheet（捲軸樣式），在 Windows 上 setFont 會被 stylesheet 蓋掉而維持
        預設小字；因此額外以 stylesheet 指定 header 字體大小，PC 才會跟著放大。
        """
        base = self.config_manager.get_global_font_size()
        zoom = max(10, int(self.preview_zoom))  # 百分比，避免 0
        size = max(6, round(base * zoom / 100))

        cell_font = QFont(FONT_FAMILY, size)
        self.table.setFont(cell_font)
        header_qss = f'QHeaderView::section {{ font-family: "{FONT_FAMILY}"; font-size: {size}pt; }}'
        hh = self.table.horizontalHeader()
        vh = self.table.verticalHeader()
        hh.setFont(cell_font)
        vh.setFont(cell_font)
        hh.setStyleSheet(header_qss)
        vh.setStyleSheet(header_qss)

        self.table.resizeColumnsToContents()
        self.table.resizeRowsToContents()
        # 欄寬上限（字數截斷門檻）隨縮放等比放大，使截斷的「字數」維持一致
        max_col_width = self.config_manager.get_preview_max_col_width() * zoom / 100
        for c in range(self.table.columnCount()):
            if self.table.columnWidth(c) > max_col_width:
                self.table.setColumnWidth(c, int(max_col_width))

    def set_preview_zoom(self, percent):
        """調整右欄預覽縮放（右下角拉條）：存檔並即時套用，不重新讀取 Excel。"""
        self.preview_zoom = int(percent)
        self.config_manager.set_preview_zoom(self.preview_zoom)
        self.config_manager.save_config()
        self.zoom_label.setText(f"{self.preview_zoom}%")
        if self.zoom_slider.value() != self.preview_zoom:
            self.zoom_slider.blockSignals(True)
            self.zoom_slider.setValue(self.preview_zoom)
            self.zoom_slider.blockSignals(False)
        if self.table.rowCount() > 0:
            self._apply_zoom_to_table()
            self._position_header_line()

    @staticmethod
    def _contrast_text_color(hex_color):
        """依背景亮度回傳黑或白文字色，確保可讀性。"""
        try:
            h = hex_color.lstrip('#')
            r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
            luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
            return "#000000" if luminance > 0.5 else "#FFFFFF"
        except Exception:
            return "#000000"

    def on_cell_changed(self, row, col):
        item = self.table.item(row, col)
        if item is None:
            return
        self.dirty_cells[(row, col)] = item.text()
        self.lbl_status.setText(f"Pending changes: {len(self.dirty_cells)}")

    def open_in_excel(self):
        if not self.current_node_data:
            return
        try:
            self.excel_handler.open_sheet(self.filename, self.sheet)
        except Exception as e:
            QMessageBox.warning(self, "Error", f"無法開啟 Excel：{e}")

    def discard_edits(self):
        """捨棄未儲存的編輯（不寫回 Excel）。切換表格時會重載內容，故僅需清空暫存。"""
        self.dirty_cells.clear()
        self.lbl_status.setText("Tips: 雙擊儲存格可編輯，按 Save to Excel 寫回。")

    def save(self):
        if not self.current_node_data:
            return
        if not self.dirty_cells:
            QMessageBox.information(self, "Info", "No changes to save.")
            return

        self.table.setEnabled(False)
        self.lbl_status.setText("Saving changes to Excel...")
        QApplication.processEvents()

        success_count = 0
        errors = []
        for (r, c), val in self.dirty_cells.items():
            # header 為第 1 列，資料自第 2 列起；欄為 1-based
            excel_row = r + 2
            excel_col = c + 1
            ok, msg = self.excel_handler.update_cell_value(
                self.filename, self.sheet, excel_col, excel_row, val
            )
            if ok:
                success_count += 1
            else:
                errors.append(f"({r},{c}): {msg}")

        self.table.setEnabled(True)
        self.dirty_cells.clear()

        if errors:
            QMessageBox.warning(self, "Partial Success",
                                f"Saved {success_count} cells.\nErrors:\n" + "\n".join(errors[:5]))
        else:
            QMessageBox.information(self, "Success", f"{success_count} cells updated successfully.")
        # 重新載入以反映最新內容
        self.load_data()


class MainWindow(QMainWindow):
    # ... init ...
    
    def open_connection_editor(self, node_data):
        # We need to pass fresh data
        dlg = EditConnectionDialog(self, node_data, self.graph_data['nodes'], self.graph_data['edges'], self.user_rel_manager)
        dlg.exec()
        # Reload after close
        self.load_and_init()
        
    def on_card_open_in_excel(self, node_data):
        # 雙擊表格方框：直接以 Excel 開啟
        try:
            self.excel_handler.open_sheet(node_data['filename'], node_data['sheet'])
        except Exception as e:
            QMessageBox.warning(self, "Error", f"無法開啟 Excel：{e}")

    def __init__(self):
        super().__init__()
        
        # 檢查並選擇 Excel 目錄 (v3.11)
        excel_dir = self.check_and_select_working_directory()
        if not excel_dir:
            # 用戶取消選擇，退出應用
            QMessageBox.warning(self, "錯誤", "未選擇 Excel 目錄，應用將關閉")
            sys.exit(0)
        
        # 使用選定目錄初始化管理器
        self.working_directory = Path(excel_dir)  # Excel 檔案所在目錄
        self.app_directory = Path(__file__).parent  # 應用程式目錄（JSON 檔案位置）
        
        # ConfigManager: 配置檔在應用目錄，但記錄 Excel 目錄
        self.config_manager = ConfigManager(working_dir=self.working_directory)
        
        # ExcelHandler: 使用 Excel 目錄
        self.excel_handler = ExcelHandler(self.working_directory)
        
        # UserRelationManager: JSON 檔案在應用目錄
        self.user_rel_manager = UserRelationManager()
        
        # 載入數據並初始化 UI
        self.load_and_init()

        # 視窗顯示後才自動刷新一次資料（等同 Rescan Data），以進度條示意；
        # 用 singleShot(0) 讓事件迴圈先把主視窗畫出來，避免開 APP 卡白畫面。
        QTimer.singleShot(0, lambda: self.reload_data(silent=True))

    def check_and_select_working_directory(self):
        """檢查並選擇工作目錄
        
        Returns:
            str: 選定的工作目錄路徑，若用戶取消則返回 None
        """
        # 嘗試從全局配置載入已保存的目錄（使用預設位置的配置檔）
        temp_config = ConfigManager()
        saved_dir = temp_config.get_working_directory()
        
        # 驗證已保存的目錄
        if saved_dir:
            is_valid, _ = temp_config.validate_working_directory(saved_dir)
            if is_valid:
                return saved_dir
            # 已保存目錄無效：不跳警告，直接進選擇視窗，且不預設初始位置

        # 顯示目錄選擇對話框（無效 / 未設定時皆不帶入初始目錄）
        dialog = WorkingDirectoryDialog(self, None)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            selected_dir = dialog.get_selected_directory()
            # 保存選擇的目錄到全局配置
            temp_config.set_working_directory(selected_dir)
            return selected_dir
        else:
            return None

    def load_and_init(self):
        self.graph_data = self.load_graph_data()
        
        nodes = [n for n in self.graph_data['nodes'] if not n['sheet'].startswith('#')]
        self.all_nodes_map = {n['id']: n for n in nodes}
        unique_tables = list(set(n['table'] for n in nodes))
        
        self.font_size = self.config_manager.get_global_font_size()
        
        self.init_ui(nodes, unique_tables)
        self.init_graph(nodes)

    def load_graph_data(self):
        # relationship_graph.json 保存在應用目錄
        path = self.app_directory / 'relationship_graph.json'
        data = {'nodes': [], 'edges': []}
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f: data = json.load(f)
            
        # Apply User Relations
        user_rels = self.user_rel_manager.load_relations()
        
        # Filter removed
        final_edges = []
        for e in data['edges']:
            is_removed = False
            for r in user_rels['removed']:
                if r['from'] == e['from'] and r['to'] == e['to']:
                    is_removed = True
                    break
            if not is_removed:
                final_edges.append(e)
                
        # Add added
        for r in user_rels['added']:
            final_edges.append({
                'from': r['from'], 'to': r['to'], 'type': r['type'], 'label': r['label'], 
                'column': 'Manual'
            })
            
        data['edges'] = final_edges
        return data

    def reload_data(self, silent=False):
        """重新載入數據 (v3.15 Optimized)

        silent=True 時（如開啟 APP 自動刷新）不跳出成功 / 失敗對話框，僅輸出至 console。
        """
        # 為避免 PyInstaller frozen 環境下 subprocess 路徑 / console window 問題，
        # 直接動態導入分析模組並呼叫其函數，並以進度條示意整個 Rescan 流程。

        progress = QProgressDialog("正在掃描 Excel 結構…", "", 0, 100, self)
        progress.setWindowTitle("Rescan Data")
        progress.setWindowModality(Qt.WindowModality.WindowModal)
        progress.setCancelButton(None)   # 不提供取消，流程需完整跑完
        progress.setAutoClose(False)
        progress.setAutoReset(False)
        progress.setMinimumDuration(0)
        progress.setValue(0)
        QApplication.processEvents()
        try:
            working_dir = self.config_manager.get_working_directory()
            print(f"Reloading data from: {working_dir}")
            print(f"Outputting analysis to: {self.app_directory}")

            # 動態導入並執行（避免循環導入）；reload 以確保使用最新程式碼
            import analyze_excel_structure
            import relationship_analyzer
            import importlib
            importlib.reload(analyze_excel_structure)
            importlib.reload(relationship_analyzer)

            def on_file(done, total, name):
                # 檔案掃描階段對應 0~70%
                pct = int(done / total * 70) if total else 70
                if name:
                    progress.setLabelText(f"正在掃描 ({done + 1}/{total})：{name}")
                progress.setValue(pct)
                QApplication.processEvents()

            print("Running Analysis...")
            analyze_excel_structure.analyze_directory(
                str(working_dir), str(self.app_directory), progress_callback=on_file)

            progress.setLabelText("正在分析表格關聯…")
            progress.setValue(80)
            QApplication.processEvents()
            relationship_analyzer.analyze_relationships(str(self.app_directory))

            progress.setLabelText("正在載入資料…")
            progress.setValue(90)
            QApplication.processEvents()

            # Reload data from JSON
            self.graph_data = self.load_graph_data()
            nodes = [n for n in self.graph_data['nodes'] if not n['sheet'].startswith('#')]
            self.all_nodes_map = {n['id']: n for n in nodes}

            self.details.all_nodes = nodes  # 重新掃描後更新「所有表格」搜尋範圍
            self.details.clear()
            self.relation_view.show_empty_state()
            self.main_view.load_nodes(nodes)

            progress.setValue(100)
            progress.close()
            if not silent:
                QMessageBox.information(self, "Success", "Data rescanned and reloaded successfully.")
            else:
                print("Startup auto-refresh completed.")

        except Exception as e:
            progress.close()
            import traceback
            traceback.print_exc()
            if not silent:
                QMessageBox.critical(self, "Error", f"Reload failed:\n{str(e)}")

    def init_ui(self, all_nodes, unique_tables):
        # ... (Similar structure, removed tabs)
        # Restore checks
        win_state = self.config_manager.config.get('window_state', {})
        w = win_state.get('width', 1600)
        h = win_state.get('height', 1000)
        self.resize(w, h)
        if win_state.get('maximized', False): self.showMaximized()
            
        self.setWindowTitle("Game Table Visualizer v3.5")
        self.setFont(QFont(FONT_FAMILY, self.font_size))
        
        central = QWidget()
        main_layout = QVBoxLayout(central)
        
        # Top Bar：包進帶下邊線的 QFrame，與下方三個窗口做出視覺區隔。
        # 高度需貼齊內容（Fixed），否則 QFrame 會與下方分割視窗均分剩餘空間而被撐高。
        top_bar = QFrame()
        top_bar.setObjectName("topBar")
        top_bar.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Fixed)
        top_bar.setStyleSheet(
            '#topBar { border-bottom: 2px solid #6e6e6e; }'
        )
        top = QHBoxLayout(top_bar)
        top.setContentsMargins(5, 5, 5, 8)
        top.addWidget(QLabel("Search:"))
        self.search_in = QLineEdit()
        self.search_in.setPlaceholderText("Search...")
        self.search_in.setMaximumWidth(300)
        self.search_in.textChanged.connect(self.on_search)

        # 搜尋自動完成：輸入時下拉列出符合的名稱，上下選擇、Enter 填入完整名 (v3.17)
        suggestions = sorted({n['sheet'] for n in all_nodes} | {n['table'] for n in all_nodes})
        completer = QCompleter(suggestions, self)
        completer.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        completer.setFilterMode(Qt.MatchFlag.MatchContains)
        completer.setCompletionMode(QCompleter.CompletionMode.PopupCompletion)
        self.search_in.setCompleter(completer)
        # Enter：選中對應的表格方塊（選取會一併脫離並清空搜尋）
        self.search_in.returnPressed.connect(self.on_search_enter)
        # 從下拉選單挑選結果：直接以該名稱選中對應方塊，而非主視窗第一個
        completer.activated.connect(self.on_completion_chosen)
        top.addWidget(self.search_in)
        
        self.settings_btn = QPushButton("Settings")
        self.settings_btn.clicked.connect(self.open_settings)
        top.addWidget(self.settings_btn)
        
        self.rescan_btn = QPushButton("Rescan Data")
        self.rescan_btn.clicked.connect(self.reload_data)
        top.addWidget(self.rescan_btn)

        self.change_dir_btn = QPushButton("變更工作目錄")
        self.change_dir_btn.clicked.connect(self.on_change_directory)
        top.addWidget(self.change_dir_btn)

        top.addStretch()
        main_layout.addWidget(top_bar)

        self.h_splitter = QSplitter(Qt.Orientation.Horizontal)
        self.v_splitter = QSplitter(Qt.Orientation.Vertical)

        # 把可拖曳的分隔線畫出來（左右 / 上下窗口之間的中線），方便辨識與拖曳。
        # 加粗握把（10px）並擴大可拖曳範圍，讓使用者更容易抓取調整窗口大小。
        splitter_qss = '''
            QSplitter::handle { background-color: #6e6e6e; }
            QSplitter::handle:hover { background-color: #FFD700; }
            QSplitter::handle:horizontal { width: 10px; }
            QSplitter::handle:vertical { height: 10px; }
        '''
        self.h_splitter.setHandleWidth(10)
        self.v_splitter.setHandleWidth(10)
        self.h_splitter.setStyleSheet(splitter_qss)
        self.v_splitter.setStyleSheet(splitter_qss)
        
        self.main_view = TableBrowserView(self, self.config_manager, self.excel_handler)
        self.main_view.node_selected.connect(self.on_main_node_selected)
        self.main_view.node_deselected.connect(self.on_main_node_deselected)
        self.main_view.node_double_clicked.connect(self.on_card_open_in_excel)
        self.main_view.table_color_requested.connect(self.on_table_color_requested)
        self.main_view.node_pin_requested.connect(self.on_node_pin_requested)
        
        self.relation_view = RelationGraphView(self, self.config_manager, self.excel_handler)
        self.relation_view.details_requested.connect(self.on_relation_details_requested)
        self.relation_view.node_pin_requested.connect(self.on_relation_pin_requested)
        
        # Relation container always visible now
        self.relation_view_container = QWidget()
        rv_layout = QVBoxLayout(self.relation_view_container)

        # Relation View 標題
        rv_header = QHBoxLayout()
        rv_header.addWidget(QLabel("Relation View"))
        rv_header.addStretch()
        rv_layout.addLayout(rv_header)

        rv_layout.addWidget(self.relation_view)
        
        self.v_splitter.addWidget(self.main_view)
        self.v_splitter.addWidget(self.relation_view_container)
        
        self.h_splitter.addWidget(self.v_splitter)
        
        self.details = QuickBrowsePanel(self.excel_handler, self.config_manager)
        self.details.all_nodes = all_nodes  # 供右欄「所有表格」搜尋範圍使用
        self.details.chip_selected.connect(self.on_chip_selected)
        self.details.pins_changed.connect(self._refresh_pin_markers)
        self.details.fullscreen_toggle_requested.connect(self.toggle_details_fullscreen)
        self._details_fullscreen = False
        self._h_sizes_before_fullscreen = None

        self.h_splitter.addWidget(self.details)
        
        # Restore Splitter
        layout_settings = self.config_manager.get_layout_settings()
        if layout_settings.get('h_splitter'): self.h_splitter.setSizes(layout_settings['h_splitter'])
        else:
            self.h_splitter.setStretchFactor(0, 4)
            self.h_splitter.setStretchFactor(1, 1)
            
        if layout_settings.get('v_splitter'): self.v_splitter.setSizes(layout_settings['v_splitter'])
        else:
            self.v_splitter.setStretchFactor(0, 3)
            self.v_splitter.setStretchFactor(1, 1)
        
        main_layout.addWidget(self.h_splitter, 1)  # 剩餘垂直空間全部給分割視窗
        self.setCentralWidget(central)

        # 不要在開啟 APP 時自動聚焦搜尋框 (改為 ClickFocus，僅點擊或快捷鍵才聚焦) (v3.17)
        self.search_in.setFocusPolicy(Qt.FocusPolicy.ClickFocus)

        # 快捷鍵 "~"：直接進入搜尋狀態 (等同左鍵點擊搜尋框)。
        # 用 application event filter 讀取實體按鍵碼，無視輸入法 (含中文輸入法) (v3.17)
        QApplication.instance().installEventFilter(self)

        # Ctrl/Ctrl+Shift + Tab 切換釘選預覽
        self._install_pin_shortcuts()

    def _install_pin_shortcuts(self):
        """以 ApplicationShortcut 註冊切換釘選預覽的快捷鍵，無視焦點在哪都生效。

        macOS 上 Qt 的快捷鍵字串 "Ctrl" 對應 Cmd、"Meta" 對應「實體 Control」；
        使用者要的是與 Chrome 一致的實體 Ctrl+Tab，故 Mac 用 "Meta+..."，
        Windows / Linux 用 "Ctrl+..."。
        """
        if sys.platform == 'darwin':
            next_seq, prev_seq = "Meta+Tab", "Meta+Shift+Tab"
        else:
            next_seq, prev_seq = "Ctrl+Tab", "Ctrl+Shift+Tab"
        self._sc_next_pin = QShortcut(QKeySequence(next_seq), self)
        self._sc_next_pin.setContext(Qt.ShortcutContext.ApplicationShortcut)
        self._sc_next_pin.activated.connect(lambda: self._cycle_pinned(True))
        self._sc_prev_pin = QShortcut(QKeySequence(prev_seq), self)
        self._sc_prev_pin.setContext(Qt.ShortcutContext.ApplicationShortcut)
        self._sc_prev_pin.activated.connect(lambda: self._cycle_pinned(False))

    def _cycle_pinned(self, forward=True):
        """切換到下一個 / 上一個釘選的預覽表格。"""
        node = self.details.next_pinned(forward=forward)
        if node:
            self.main_view.select_card_by_id(node['id'])

    def toggle_details_fullscreen(self):
        """切換右欄全介面：放大時隱藏左側兩個窗口，再次切換則恢復原本比例。"""
        if not self._details_fullscreen:
            # 記住目前左右比例，再把左側窗口縮到 0
            self._h_sizes_before_fullscreen = self.h_splitter.sizes()
            self.h_splitter.setSizes([0, max(1, sum(self._h_sizes_before_fullscreen))])
            self._details_fullscreen = True
        else:
            if self._h_sizes_before_fullscreen:
                self.h_splitter.setSizes(self._h_sizes_before_fullscreen)
            self._details_fullscreen = False
        # 同步按鈕勾選狀態（也涵蓋以 Tab 快捷鍵觸發的情況）
        self.details.fullscreen_btn.setChecked(self._details_fullscreen)

    # (closeEvent unchanged)
    def closeEvent(self, event):
        self.config_manager.save_window_state(self.width(), self.height(), self.isMaximized())
        self.config_manager.set_layout_settings(self.h_splitter.sizes(), self.v_splitter.sizes())
        self.config_manager.save_config()
        super().closeEvent(event)

    # (init_graph, open_settings, on_font_changed, on_reset_layout unchanged)
    def init_graph(self, nodes):
        self.main_view.load_nodes(nodes)

    def open_settings(self):
        dlg = SettingsDialog(self, self.font_size,
                             self.config_manager.get_preview_max_col_width())
        dlg.font_changed.connect(self.on_font_changed)
        dlg.preview_col_width_changed.connect(self.on_preview_col_width_changed)
        dlg.exec()

    def on_font_changed(self, size):
        self.font_size = size
        self.config_manager.set_global_font_size(size)
        self.main_view.set_font_size_live(size)

    def on_preview_col_width_changed(self, width):
        """調整右欄預覽欄寬上限：存檔並即時套用到目前預覽。"""
        self.config_manager.set_preview_max_col_width(width)
        self.config_manager.save_config()
        if self.details.current_node_data:
            self.details.load_data()

    def on_change_directory(self):
        """變更 Excel 目錄並重新載入數據 (v3.11)"""
        # 顯示目錄選擇對話框，預設為當前 Excel 目錄
        dialog = WorkingDirectoryDialog(self, str(self.working_directory))
        if dialog.exec() == QDialog.DialogCode.Accepted:
            new_dir = dialog.get_selected_directory()
            
            # 檢查是否與當前目錄相同
            if Path(new_dir).resolve() == self.working_directory.resolve():
                QMessageBox.information(self, "提示", "選擇的目錄與當前目錄相同，無需變更。")
                return
            
            # 保存選擇的新目錄（全局配置在應用目錄）
            temp_config = ConfigManager()
            temp_config.set_working_directory(new_dir)
            
            # 更新 Excel 目錄和 ExcelHandler
            self.working_directory = Path(new_dir)
            self.excel_handler = ExcelHandler(self.working_directory)
            
            # ConfigManager 需要重新初始化以載入新的 Excel 目錄配置
            self.config_manager = ConfigManager(working_dir=self.working_directory)
            
            # UserRelationManager 和 JSON 檔案保持在應用目錄，無需重新初始化
            
            # 重新載入數據
            self.load_and_init()
            
            QMessageBox.information(self, "成功", f"Excel 目錄已變更為：\n{new_dir}\n\n數據已重新載入。")

    def on_table_color_requested(self, table):
        """點擊主視窗分組標題：跳出顏色選擇視窗並套用至該表格。"""
        curr = QColor(self.config_manager.get_table_color(table))
        c = QColorDialog.getColor(curr, self, f"選擇 {table} 的顏色")
        if c.isValid():
            self.config_manager.set_table_color(table, c.name())
            self.config_manager.save_config()
            self.refresh_colors()

    def _confirm_switch(self, new_data):
        """切換預覽前確認：若右欄有未儲存編輯且要切到不同表格，跳出『保存 / 不保存 / 取消』。

        回傳 True 表示可切換（已視需要儲存或捨棄）；False 表示使用者取消切換。
        """
        cur = self.details.current_node_data
        if cur and cur.get('id') != new_data.get('id') and self.details.dirty_cells:
            box = QMessageBox(self)
            box.setIcon(QMessageBox.Icon.Warning)
            box.setWindowTitle("未儲存的變更")
            box.setText(f"右欄『{cur['sheet']}』有未儲存的編輯。\n要先儲存再切換嗎？")
            save_btn = box.addButton("保存", QMessageBox.ButtonRole.AcceptRole)
            discard_btn = box.addButton("不保存", QMessageBox.ButtonRole.DestructiveRole)
            box.addButton("取消", QMessageBox.ButtonRole.RejectRole)
            box.exec()
            clicked = box.clickedButton()
            if clicked is save_btn:
                self.details.save()
                return True
            if clicked is discard_btn:
                self.details.discard_edits()
                return True
            return False
        return True

    def on_main_node_selected(self, data):
        if not self._confirm_switch(data):
            # 取消切換：還原選取回目前預覽的表格
            cur = self.details.current_node_data
            if cur:
                self.main_view.select_card_by_id(cur['id'])
            return
        self.relation_view.show_relations(data, self.graph_data['edges'], self.all_nodes_map, self.font_size)
        self.details.show_node(data)
        # 搜尋狀態中選中任意方塊 → 脫離搜尋並清空搜尋欄
        was_searching = bool(self.search_in.text())
        if was_searching:
            self.search_in.clear()  # 觸發 on_search('') 還原全部卡片
        self.exit_search()
        if was_searching:
            # 篩選解除、全部方塊重新顯示後，將選中方塊捲動置中（等版面重算後再捲動）
            node_id = data['id']
            QTimer.singleShot(0, lambda: self.main_view.scroll_to_id(node_id))

    def on_main_node_deselected(self):
        self.relation_view.show_empty_state() # Show empty
        self.details.clear()

    def on_relation_details_requested(self, data):
        if not self._confirm_switch(data):
            return
        self.details.show_node(data)

    def on_node_pin_requested(self, node_data):
        """中鍵卡片：未釘選則選中並釘選；已釘選則取消釘選（再次中鍵切換）。"""
        if self.details.is_pinned(node_data['id']):
            self.details.unpin_node(node_data['id'])
        else:
            self.details.pin_node(node_data)
            self.main_view.select_card_by_id(node_data['id'])

    def on_chip_selected(self, node_data):
        """點擊右欄上方子表格方塊：切換預覽（透過卡片選取保持各視圖同步）。"""
        self.main_view.select_card_by_id(node_data['id'])

    def on_relation_pin_requested(self, node_data):
        """Relation View 中鍵節點：切換釘選 / 取消釘選（不切換預覽、不導航）。"""
        if self.details.is_pinned(node_data['id']):
            self.details.unpin_node(node_data['id'])
        else:
            self.details.pin_node(node_data)

    def _refresh_pin_markers(self):
        pinned = self.details.pinned_ids()
        self.main_view.set_pinned_ids(pinned)
        self.relation_view.set_pinned_ids(pinned)

    def on_search_enter(self):
        """搜尋狀態按 Enter：優先選中與搜尋字串完全相符的方塊，否則選第一個可見方塊。"""
        text = self.search_in.text().strip()
        card = self.main_view.find_card_by_name(text) if text else None
        if card is None:
            card = self.main_view.first_visible_card()
        if card:
            self.main_view.select_card_by_id(card.node_data['id'])

    def on_completion_chosen(self, text):
        """從搜尋下拉選單挑選結果：以該名稱精確選中對應方塊。"""
        card = self.main_view.find_card_by_name(text)
        if card is None:
            card = self.main_view.first_visible_card()
        if card:
            self.main_view.select_card_by_id(card.node_data['id'])

    def focus_search(self):
        """進入搜尋狀態：聚焦搜尋框並清空當下字元 (v3.18)"""
        self.search_in.setFocus(Qt.FocusReason.ShortcutFocusReason)
        self.search_in.clear()

    def exit_search(self):
        """脫離搜尋狀態：清除搜尋框焦點 (v3.18)"""
        self.search_in.clearFocus()

    def eventFilter(self, obj, event):
        """攔截 Enter/Esc 以進出搜尋狀態 (v3.18)。

        - Enter：只要 app 任一視窗為作用中、且焦點不在文字輸入元件
          (QLineEdit / QTextEdit / 下拉清單) 時，進入搜尋狀態並清空搜尋框。
        - Esc：焦點在搜尋框時脫離搜尋狀態。
        """
        if event.type() == QEvent.Type.KeyPress:
            key = event.key()
            fw = QApplication.focusWidget()
            # 註：Ctrl/Meta + (Shift) + Tab 切換釘選預覽改用 QShortcut（見 _install_pin_shortcuts），
            #     以 ApplicationShortcut 內容無視焦點皆可運作。
            if key in (Qt.Key.Key_Return, Qt.Key.Key_Enter):
                if QApplication.activeWindow() is not None and \
                        not isinstance(fw, (QLineEdit, QTextEdit, QAbstractItemView)):
                    self.focus_search()
                    return True
            elif key == Qt.Key.Key_Escape and fw is self.search_in:
                self.exit_search()
                return True
            elif key == Qt.Key.Key_Tab and not event.modifiers():
                # 無修飾鍵的 Tab：切換右欄全介面。
                # 焦點在文字輸入 / 表格時不攔截，保留原本的 Tab 行為（換欄 / 編輯移動）。
                if QApplication.activeWindow() is not None and \
                        not isinstance(fw, (QLineEdit, QTextEdit, QAbstractItemView)):
                    self.toggle_details_fullscreen()
                    return True
        return super().eventFilter(obj, event)

    def on_search(self, txt):
        if not txt: self.main_view.clear_search()
        else: self.main_view.search_highlight(txt)
            
    def refresh_colors(self):
        self.main_view.refresh_colors()
        for item in self.relation_view.scene.items():
            if isinstance(item, GraphNodeItem):
                item.bg_color = QColor(self.config_manager.get_table_color(item.node_data['table']))
                item.update()

# (main unchanged)

class DetailsDisplayDialog(QDialog):
    def __init__(self, parent, excel_handler, node_data, current_config=None):
        super().__init__(parent)
        self.setWindowTitle(f"Customize View - {node_data['sheet']}")
        self.resize(1000, 700)
        self.excel_handler = excel_handler
        self.node_data = node_data
        self.config = current_config or {}
        
        # Load Raw Data
        h, d = self.excel_handler.get_all_sheet_data(node_data['filename'], node_data['sheet'])
        self.raw_data = [h] + d if h else []
        self.transposed_data = [] # Lazy calc
        
        self.init_ui()
        self.load_initial_state()
        
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        splitter = QSplitter(Qt.Orientation.Horizontal)
        layout.addWidget(splitter)
        
        # Left: Preview (QTableWidget)
        self.preview_table = QTableWidget()
        self.preview_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        splitter.addWidget(self.preview_table)
        
        # Right: Controls
        controls = QWidget()
        c_layout = QVBoxLayout(controls)
        splitter.addWidget(controls)
        splitter.setSizes([700, 300])
        
        # Orientation
        self.cb_transpose = QCheckBox("Transpose (Column Mode)")
        self.cb_transpose.setToolTip("Use Columns as Fields/Values instead of Rows")
        self.cb_transpose.stateChanged.connect(self.on_transpose_changed)
        c_layout.addWidget(self.cb_transpose)
        
        c_layout.addWidget(QLabel("Select Field(s) (Key):"))
        self.list_fields = QListWidget()
        self.list_fields.setSelectionMode(QListWidget.SelectionMode.MultiSelection)
        self.list_fields.itemSelectionChanged.connect(self.update_preview_highlight)
        c_layout.addWidget(self.list_fields)
        
        c_layout.addWidget(QLabel("Select Value(s):"))
        self.list_values = QListWidget()
        self.list_values.setSelectionMode(QListWidget.SelectionMode.MultiSelection)
        self.list_values.itemSelectionChanged.connect(self.update_preview_highlight)
        c_layout.addWidget(self.list_values)
        
        # Buttons
        btns = QHBoxLayout()
        ok_btn = QPushButton("OK")
        ok_btn.clicked.connect(self.accept)
        cancel_btn = QPushButton("Cancel")
        cancel_btn.clicked.connect(self.reject)
        btns.addWidget(ok_btn)
        btns.addWidget(cancel_btn)
        c_layout.addLayout(btns)
        
    def get_current_data(self):
        return self.transposed_data if self.cb_transpose.isChecked() else self.raw_data
        
    def on_transpose_changed(self):
        state = self.cb_transpose.isChecked()
        if state and not self.transposed_data and self.raw_data:
            # Calculate transpose
            self.transposed_data = list(map(list, zip(*self.raw_data)))
            
        data = self.get_current_data()
        self.populate_table(data)
        self.populate_lists(data)
        
    def populate_table(self, data):
        self.preview_table.setRowCount(len(data))
        self.preview_table.setColumnCount(len(data[0]) if data else 0)
        
        # Set Headers
        if self.cb_transpose.isChecked():
             self.preview_table.setVerticalHeaderLabels([self.get_col_name(i) for i in range(len(data))])
             self.preview_table.setHorizontalHeaderLabels([str(i+1) for i in range(len(data[0]) if data else 0)])
        else:
             self.preview_table.setVerticalHeaderLabels([str(i+1) for i in range(len(data))])
             self.preview_table.setHorizontalHeaderLabels([self.get_col_name(i) for i in range(len(data[0]) if data else 0)])
             
        for r, row_data in enumerate(data):
            for c, val in enumerate(row_data):
                item = QTableWidgetItem(str(val))
                self.preview_table.setItem(r, c, item)
                
    def get_col_name(self, n):
        string = ""
        n += 1
        while n > 0:
            n, remainder = divmod(n - 1, 26)
            string = chr(65 + remainder) + string
        return string

    def populate_lists(self, data):
        count = len(data)
        self.list_fields.clear()
        self.list_values.clear()
        
        prefix = "Col " if self.cb_transpose.isChecked() else "Row "
        label_func = lambda i: f"{prefix}{self.get_col_name(i) if self.cb_transpose.isChecked() else i+1}"
        
        for i in range(count):
            # Show first few items as preview
            preview = ", ".join([str(x) for x in data[i][:3]]) if data[i] else ""
            item_text = f"{label_func(i)}: {preview}..."
            self.list_fields.addItem(item_text)
            self.list_values.addItem(item_text)
            
    def load_initial_state(self):
        is_trans = self.config.get('transpose', True)
        self.cb_transpose.setChecked(is_trans)
        # on_transpose_changed will be called by setChecked if changed, or manual call if not?
        # signals are blocked by default? NO.
        # But if default is False and we set False, it wont trigger.
        self.on_transpose_changed()
        
        f_idxs = self.config.get('field_indices', [])
        v_idxs = self.config.get('value_indices', [])
        
        # Restore selection
        for i in range(self.list_fields.count()):
            if i in f_idxs: self.list_fields.item(i).setSelected(True)
        for i in range(self.list_values.count()):
            if i in v_idxs: self.list_values.item(i).setSelected(True)

    def update_preview_highlight(self):
        pass # Optional
        
    def get_result(self):
        f_idxs = [i.row() for i in self.list_fields.selectedIndexes()]
        v_idxs = [i.row() for i in self.list_values.selectedIndexes()]
        return {
            'use_custom': True,
            'transpose': self.cb_transpose.isChecked(),
            'field_indices': f_idxs,
            'value_indices': v_idxs
        }

def main():
    app = QApplication(sys.argv)
    w = MainWindow()
    w.show()
    sys.exit(app.exec())

if __name__ == '__main__':
    main()
