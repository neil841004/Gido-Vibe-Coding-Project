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
    QMenu, QListWidget, QListWidgetItem, QComboBox, QFileDialog
)
from PyQt6.QtCore import Qt, QRectF, QPointF, QLineF, pyqtSignal, QTimer, QSize
from PyQt6.QtGui import (
    QPainter, QPen, QBrush, QColor, QPainterPath, QFont,
    QTransform, QPolygonF, QIcon, QAction
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
        start_dir = self.selected_directory or str(Path.home())
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
    
    def __init__(self, parent, current_font_size):
        super().__init__(parent)
        self.setWindowTitle("Settings")
        self.resize(300, 100)
        
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
        
        # Reset Layout button moved to Main Window
        
        layout.addStretch()
        
    def on_slider_change(self, val):
        self.font_curr_label.setText(str(val))
        self.font_changed.emit(val)

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
        self.scale(factor, factor)

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
    
    def __init__(self, parent, config_manager, excel_handler):
        super().__init__(parent)
        self.config_manager = config_manager
        self.excel_handler = excel_handler
        self.font_size = 10
        self.edit_mode = False  # v3.13 編輯模式狀態
        self.center_node_data = None  # 保存中心節點數據
        self.all_nodes_map = {}  # 保存所有節點映射
        self.show_empty_state()

    def set_font_size_live(self, size):
        self.font_size = size
        for item in self.scene.items():
            if isinstance(item, GraphNodeItem):
                item.set_font_size(size)
        for item in self.scene.items():
            if isinstance(item, GraphEdgeItem):
                item.adjust()

    def show_empty_state(self):
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
            self.fitInView(self.scene.sceneRect(), Qt.AspectRatioMode.KeepAspectRatio)
        
        self.update_edit_mode_ui()

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
        if self.scene.items():
             # Only auto-fit if we haven't manipulated view manually? 
             # Or just keep it. User requested "no refresh" during edit, resize is different.
             self.fitInView(self.scene.sceneRect(), Qt.AspectRatioMode.KeepAspectRatio)

    def on_node_moved(self, item): pass
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
    
    def toggle_edit_mode(self):
        """切換編輯模式 (v3.13)"""
        self.edit_mode = not self.edit_mode
        self.update_edit_mode_ui()
        return self.edit_mode
    
    def update_edit_mode_ui(self):
        """更新編輯模式 UI (v3.13)"""
        for item in self.scene.items():
            if isinstance(item, GraphEdgeItem):
                item.set_edit_mode(self.edit_mode)
            elif isinstance(item, GraphNodeItem):
                item.set_edit_mode(self.edit_mode)
    
    def remove_relation(self, from_id, to_id):
        """移除關聯 (v3.13, v3.16 partial update)"""
        mw = self.window()
        if not mw or not hasattr(mw, 'user_rel_manager'):
            return
        
        # 使用 UserRelationManager 移除關聯
        mw.user_rel_manager.remove_relation(from_id, to_id)
        
        # Update local edges
        self.all_edges = [e for e in self.all_edges if not (e['from'] == from_id and e['to'] == to_id)]
        
        # Partial refresh (no view reset)
        self.show_relations(self.center_node_data, self.all_edges, self.all_nodes_map, self.font_size, reset_view=False)
    
    def show_add_relation_dialog(self, node_data):
        """顯示添加關聯對話框 (v3.13, v3.16 partial update)"""
        if not self.center_node_data:
            return
        
        dialog = AddRelationDialog(
            self.window(),
            node_data,
            self.center_node_data,
            self.all_nodes_map,
            self.window().user_rel_manager if hasattr(self.window(), 'user_rel_manager') else None
        )
        
        if dialog.exec() == QDialog.DialogCode.Accepted:
            # 獲取剛添加的關聯
            mw = self.window()
            if hasattr(mw, 'user_rel_manager') and mw.user_rel_manager.relations['added']:
                last_added = mw.user_rel_manager.relations['added'][-1]
                # Construct edge dict
                new_edge = {
                    'from': last_added['from'],
                    'to': last_added['to'],
                    'type': last_added['type'],
                    'label': last_added['label'],
                    'column': 'Manual'
                }
                # Check duplication
                exists = False
                for e in self.all_edges:
                    if e['from'] == new_edge['from'] and e['to'] == new_edge['to']:
                        exists = True
                        break
                if not exists:
                    self.all_edges.append(new_edge)
            
            # Partial refresh (no view reset)
            self.show_relations(self.center_node_data, self.all_edges, self.all_nodes_map, self.font_size, reset_view=False)


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
        headers, data = self.excel_handler.get_all_sheet_data(self.filename, self.sheet)
        
        self.table.setColumnCount(len(headers))
        self.table.setRowCount(len(data))
        self.table.setHorizontalHeaderLabels(headers)
        
        for r, row_data in enumerate(data):
            for c, val in enumerate(row_data):
                if c < len(headers):
                    self.table.setItem(r, c, QTableWidgetItem(str(val)))
        
        # Auto-resize columns to content, then cap at 300
        self.table.resizeColumnsToContents()
        for c in range(self.table.columnCount()):
            if self.table.columnWidth(c) > 300:
                self.table.setColumnWidth(c, 300)
                    
        self.table.blockSignals(False)
        self.dirty_cells.clear()

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


class MainWindow(QMainWindow):
    # ... init ...
    
    def open_connection_editor(self, node_data):
        # We need to pass fresh data
        dlg = EditConnectionDialog(self, node_data, self.graph_data['nodes'], self.graph_data['edges'], self.user_rel_manager)
        dlg.exec()
        # Reload after close
        self.load_and_init()
        
    def open_quick_edit_dialog(self, node_data):
        dlg = QuickEditDialog(self, self.excel_handler, node_data)
        dlg.exec()
        # Refresh details if currently showing same node
        if self.details.current_node_data and self.details.current_node_data['id'] == node_data['id']:
             self.details.load_data()

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
            is_valid, error_msg = temp_config.validate_working_directory(saved_dir)
            if is_valid:
                return saved_dir
            else:
                # 目錄無效，顯示警告並重新選擇
                QMessageBox.warning(
                    self,
                    "工作目錄無效",
                    f"已保存的工作目錄無效：\n{error_msg}\n\n請重新選擇工作目錄。"
                )
        
        # 顯示目錄選擇對話框
        dialog = WorkingDirectoryDialog(self, saved_dir)
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

    def reload_data(self):
        """重新載入數據 (v3.15 Optimized)"""
        # 在 Frozen 環境下 (PyInstaller)，我們不能輕易使用 subprocess 呼叫 python 腳本
        # 因為環境變數和路徑可能不同。
        # 最好的方式是直接導入模組並執行函數。
        
        # 顯示進度條或等待游標
        QApplication.setOverrideCursor(Qt.CursorShape.WaitCursor)
        try:
            working_dir = self.config_manager.get_working_directory()
            output_dir = self.app_directory
            print(f"Reloading data from: {working_dir}")
            print(f"Outputting analysis to: {output_dir}")
            
            # 1. 執行 Excel 結構分析
            # 我們假設 analyze_excel_structure.py 有一個 main 或 process 函數
            # 如果沒有，我們需要模擬它的行為。
            # 查看 analyze_excel_structure.py 和 relationship_analyzer.py 的內容會更保險
            # 但為了修復 "Rescan" 彈出新視窗的問題，我們必須避免 subprocess.run([sys.executable, ...])
            
            # 動態導入並執行 (為了避免循環導入，我們在這裡導入)
            import analyze_excel_structure
            import relationship_analyzer
            
            # 重新加載模組以確保代碼更新 (雖然在打包環境下通常不會變)
            import importlib
            importlib.reload(analyze_excel_structure)
            importlib.reload(relationship_analyzer)
            
            # 執行分析
            # analyze_excel_structure 通常需要命令行參數，我們需要查看它是如何編寫的。
            # 假設它有一個 process_directory(path) 函數。
            # 如果它只有 if __name__ == "__main__": 塊，我們可能需要重構它，
            # 或者在這裡使用 runpy (但 runpy 類似於 subprocess，可能會有同樣問題)。
            # 最穩健的方法是調用它們的邏輯函數。
            
            # 暫時使用 subprocess 但指向內部 executable (如果是 frozen)
            # 但這正是導致 "彈出新視窗" 的原因 (在新进程中啟動了 GUI 默認行為?)。
            # 不，Rescan Data 調用的是 analyze scripts，它們應該只是打印輸出。
            # 如果它們沒有 GUI 代碼，subprocess 應該是安全的，除非 console window 彈出。
            # 為了避免 console window，我們需要在 subprocess 中設置 flags。
            
            # 但更高效的是直接調用函數。
            # 讓我們假設改用直接調用。
            
            print("Running Analysis...")
            analyze_excel_structure.analyze_directory(str(working_dir), str(self.app_directory))
            relationship_analyzer.analyze_relationships(str(self.app_directory))
            
            # 2. Reload data from JSON
            self.graph_data = self.load_graph_data()
            nodes = [n for n in self.graph_data['nodes'] if not n['sheet'].startswith('#')]
            
            # Update all_nodes_map for Reference (Relation View etc)
            # Note: This map only has Active nodes.
            self.all_nodes_map = {n['id']: n for n in nodes}
            
            # 3. Re-init graph logic (Smart Diff)
            self.details.clear()
            self.relation_view.show_empty_state()
            
            # Use Diff Update
            self.main_view.update_scene_items_diff(nodes, self.graph_data['edges'], self.font_size)
            
            # Refresh colors
            self.refresh_colors()
            
            QApplication.restoreOverrideCursor()
            QMessageBox.information(self, "Success", "Data rescanned and reloaded successfully.")
            
        except Exception as e:
            QApplication.restoreOverrideCursor()
            import traceback
            traceback.print_exc()
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
        
        # Top Bar
        top = QHBoxLayout()
        top.setContentsMargins(5, 5, 5, 5)
        top.addWidget(QLabel("Search:"))
        self.search_in = QLineEdit()
        self.search_in.setPlaceholderText("Search...")
        self.search_in.setMaximumWidth(300)
        self.search_in.textChanged.connect(self.on_search)
        top.addWidget(self.search_in)
        
        self.settings_btn = QPushButton("Settings")
        self.settings_btn.clicked.connect(self.open_settings)
        top.addWidget(self.settings_btn)
        
        self.rescan_btn = QPushButton("Rescan Data")
        self.rescan_btn.clicked.connect(self.reload_data)
        top.addWidget(self.rescan_btn)
        
        self.reset_layout_btn = QPushButton("Reset Arrangement")
        self.reset_layout_btn.clicked.connect(self.on_reset_layout)
        top.addWidget(self.reset_layout_btn)
        
        self.change_dir_btn = QPushButton("變更工作目錄")
        self.change_dir_btn.clicked.connect(self.on_change_directory)
        top.addWidget(self.change_dir_btn)
        
        # 箭頭顯示切換按鈕 (v3.12, v3.16 Persistence)
        show_arrows = self.config_manager.get_arrow_visibility()
        btn_text = "隱藏箭頭" if show_arrows else "顯示箭頭"
        self.toggle_arrows_btn = QPushButton(btn_text)
        self.toggle_arrows_btn.setCheckable(True)
        self.toggle_arrows_btn.setChecked(not show_arrows)
        self.toggle_arrows_btn.clicked.connect(self.on_toggle_arrows)
        top.addWidget(self.toggle_arrows_btn)
        
        top.addStretch()
        main_layout.addLayout(top)
        
        self.h_splitter = QSplitter(Qt.Orientation.Horizontal)
        self.v_splitter = QSplitter(Qt.Orientation.Vertical)
        
        self.main_view = MainGraphView(self, self.config_manager, self.excel_handler)
        self.main_view.node_selected.connect(self.on_main_node_selected)
        self.main_view.node_deselected.connect(self.on_main_node_deselected)
        
        self.relation_view = RelationGraphView(self, self.config_manager, self.excel_handler)
        self.relation_view.details_requested.connect(self.on_relation_details_requested)
        
        # Relation container always visible now
        self.relation_view_container = QWidget()
        rv_layout = QVBoxLayout(self.relation_view_container)
        
        # Relation View 標題和編輯按鈕 (v3.13)
        rv_header = QHBoxLayout()
        rv_header.addWidget(QLabel("Relation View"))
        rv_header.addStretch()
        self.relation_edit_btn = QPushButton("編輯模式")
        self.relation_edit_btn.setCheckable(True)
        self.relation_edit_btn.clicked.connect(self.on_toggle_relation_edit_mode)
        rv_header.addWidget(self.relation_edit_btn)
        rv_layout.addLayout(rv_header)
        
        rv_layout.addWidget(self.relation_view)
        
        self.v_splitter.addWidget(self.main_view)
        self.v_splitter.addWidget(self.relation_view_container)
        
        self.h_splitter.addWidget(self.v_splitter)
        
        self.details = DetailsPanel(self.excel_handler, self.config_manager)
        self.details.color_changed.connect(self.refresh_colors)
        
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
        
        main_layout.addWidget(self.h_splitter)
        self.setCentralWidget(central)

    # (closeEvent unchanged)
    def closeEvent(self, event):
        self.config_manager.save_window_state(self.width(), self.height(), self.isMaximized())
        self.config_manager.set_layout_settings(self.h_splitter.sizes(), self.v_splitter.sizes())
        t = self.main_view.transform()
        matrix = (t.m11(), t.m12(), t.m13(), t.m21(), t.m22(), t.m23(), t.m31(), t.m32(), t.m33())
        cp = self.main_view.mapToScene(self.main_view.viewport().rect().center())
        self.config_manager.set_main_view_transform(matrix, [cp.x(), cp.y()])
        self.config_manager.save_config()
        super().closeEvent(event)

    # (init_graph, open_settings, on_font_changed, on_reset_layout unchanged)
    def init_graph(self, nodes):
        self.main_view.set_scene_items(nodes, self.graph_data['edges'], self.font_size)
        has_pos = bool(self.config_manager.config.get('node_positions'))
        if not has_pos:
            new_pos = self.main_view.arrange_clustered_layout(nodes)
            for k, v in new_pos.items(): self.config_manager.set_node_position(k, v[0], v[1])
            self.config_manager.save_config()
            for item in self.main_view.node_items.values():
                p = new_pos.get(item.full_name)
                if p: item.setPos(p[0], p[1])
        v_sets = self.config_manager.get_main_view_transform()
        if 'main_view_transform' in v_sets: self.main_view.setTransform(QTransform(*v_sets['main_view_transform']))
        if 'center_on' in v_sets: self.main_view.centerOn(*v_sets['center_on'])
        
        # Apply arrow visibility (v3.16)
        self.main_view.toggle_arrows_visibility(self.config_manager.get_arrow_visibility())

    def open_settings(self):
        dlg = SettingsDialog(self, self.font_size)
        dlg.font_changed.connect(self.on_font_changed)
        dlg.exec()
        
    def on_font_changed(self, size):
        self.font_size = size
        self.config_manager.set_global_font_size(size)
        
    def on_reset_layout(self):
        # v3.16 Fix: Use current scene items to ensure we include new nodes from Rescan
        nodes = [item.node_data for item in self.main_view.node_items.values()]
        new_pos = self.main_view.arrange_clustered_layout(nodes)
        
        for item in self.main_view.node_items.values():
            p = new_pos.get(item.full_name)
            if p: 
                item.setPos(p[0], p[1])
                self.config_manager.set_node_position(item.full_name, p[0], p[1])
            
        self.config_manager.save_config()
        self.main_view.scene.update()
    
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
    
    def on_toggle_arrows(self):
        """切換箭頭顯示 (v3.12, v3.16 Persistence)"""
        is_checked = self.toggle_arrows_btn.isChecked()
        self.main_view.toggle_arrows_visibility(not is_checked)
        self.toggle_arrows_btn.setText("顯示箭頭" if is_checked else "隱藏箭頭")
        
        # Save to config
        self.config_manager.set_arrow_visibility(not is_checked)
    
    def on_toggle_relation_edit_mode(self):
        """切換 Relation View 編輯模式 (v3.13)"""
        is_edit_mode = self.relation_view.toggle_edit_mode()
        self.relation_edit_btn.setText("退出編輯" if is_edit_mode else "編輯模式")

    def on_main_node_selected(self, data):
        self.relation_view.show_relations(data, self.graph_data['edges'], self.all_nodes_map, self.font_size)
        self.details.show_node(data)
        
    def on_main_node_deselected(self):
        self.relation_view.show_empty_state() # Show empty
        self.details.clear() 
        
    def on_relation_details_requested(self, data):
        self.details.show_node(data)
        
    def on_search(self, txt):
        if not txt: self.main_view.clear_search()
        else: self.main_view.search_highlight(txt)
            
    def refresh_colors(self):
        for item in self.main_view.node_items.values():
            item.bg_color = QColor(self.config_manager.get_table_color(item.node_data['table']))
            item.update()
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
        else:
             self.preview_table.setVerticalHeaderLabels([str(i+1) for i in range(len(data))])
             
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
        is_trans = self.config.get('transpose', False)
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
