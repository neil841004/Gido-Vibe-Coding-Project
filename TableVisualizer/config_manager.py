#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
組態管理器
負責儲存和載入應用程式設定，包括節點位置、顏色偏好等
"""

import json
import os
import sys
import shutil
from pathlib import Path

class ConfigManager:
    def __init__(self, working_dir=None, config_file='gui_config.json'):
        # Determine application directory (handle PyInstaller frozen state)
        if getattr(sys, 'frozen', False):
            # If the application is run as a bundle, the PyInstaller bootloader
            # extends the sys module by a flag frozen=True and sets the app 
            # path into variable _MEIPASS'.
            self.app_dir = Path(sys.executable).parent
            
            # Handle macOS .app bundle
            if sys.platform == 'darwin' and 'Contents/MacOS' in str(self.app_dir):
                 # Go up to the directory containing .app
                 # .../MyApp.app/Contents/MacOS -> .../MyApp.app -> .../
                 self.app_dir = self.app_dir.parent.parent.parent

        else:
            self.app_dir = Path(__file__).parent
            
        self.config_path = self.app_dir / config_file
        
        # If running as frozen application and config doesn't exist in writable location,
        # try to copy the bundled default config (captured at build time).
        if getattr(sys, 'frozen', False) and not self.config_path.exists():
            try:
                # Potential locations for bundled config
                candidates = []
                # 1. sys._MEIPASS (PyInstaller OneFile / Temp Dir / OneDir)
                if hasattr(sys, '_MEIPASS'):
                    candidates.append(Path(sys._MEIPASS) / config_file)
                
                # 2. Executable Directory (PyInstaller OneDir)
                candidates.append(Path(sys.executable).parent / config_file)

                # 3. Internal contents directory (Windows --contents-directory)
                # If executable is in root, sys.executable is root/App.exe
                # but bundled files might be in root/internal
                # However, add-data usually puts them in _MEIPASS, so #1 should cover it.
                
                # 4. macOS Resources (PyInstaller .app bundle)
                if sys.platform == 'darwin':
                    # .../TableVisualizer.app/Contents/MacOS/TableVisualizer -> .../Contents/Resources
                    candidates.append(Path(sys.executable).parent.parent / 'Resources' / config_file)
                
                for src in candidates:
                    if src.exists():
                        shutil.copy2(src, self.config_path)
                        print(f"Initialized config from bundled file: {src}")
                        break
            except Exception as e:
                print(f"Failed to copy bundled config: {e}")
        
        # working_dir 用於儲存 Excel 檔案所在目錄（若提供）
        if working_dir is None:
            self.excel_dir = None  # 尚未設定
        else:
            self.excel_dir = Path(working_dir)
        
        self.config = {
            'working_directory': str(self.excel_dir) if self.excel_dir else None,  # Excel 檔案目錄
            'node_positions': {},  # 儲存 "Table.Sheet": [x, y]
            'table_colors': {},    # 儲存 "TableName": "#HexColor"
            'sheet_settings': {},  # 儲存 "Table.Sheet": { "param_row": 4, "hidden_fields": [] }
            'layout_settings': {   # 儲存介面佈局
                'h_splitter': [],  # [size1, size2]
                'v_splitter': []   # [size1, size2]
            },
            'window_state': {
                'width': 1600,
                'height': 900,
                'maximized': False
            },
            'global_settings': {
                'font_size': 10
            },
            'view_settings': {
                'main_view_transform': [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0], # QTransform 3x3 matrix elements
                'center_on': [0.0, 0.0] # Scene Center Point x, y
            },
            'last_view': {
                'scale': 1.0,
                'center_x': 0,
                'center_y': 0
            }
        }
        self.load_config()

    def load_config(self):
        """載入設定"""
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    saved_config = json.load(f)
                    self._recursive_update(self.config, saved_config)
                print(f"Config loaded from {self.config_path}")
            except Exception as e:
                print(f"Failed to load config: {e}")

    def _recursive_update(self, d, u):
        """遞迴更新字典"""
        for k, v in u.items():
            if isinstance(v, dict):
                d[k] = self._recursive_update(d.get(k, {}), v)
            else:
                d[k] = v
        return d

    def save_config(self):
        """儲存設定"""
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            print("Config saved")
        except Exception as e:
            print(f"Failed to save config: {e}")

    def get_node_position(self, node_id):
        """獲取節點位置"""
        return self.config['node_positions'].get(str(node_id))

    def set_node_position(self, node_id, x, y):
        """設定節點位置"""
        self.config['node_positions'][str(node_id)] = [float(x), float(y)]

    def get_table_color(self, table_name, default_color='#9E9E9E'):
        """獲取表格顏色"""
        return self.config['table_colors'].get(table_name, default_color)

    def set_table_color(self, table_name, color):
        """設定表格顏色"""
        self.config['table_colors'][table_name] = color

    def get_sheet_param_row(self, sheet_full_name):
        """獲取工作表的參數列索引 (預設 4)"""
        settings = self.config['sheet_settings'].get(sheet_full_name, {})
        return settings.get('param_row', 4)

    def set_sheet_param_row(self, sheet_full_name, row_idx):
        """設定工作表的參數列索引"""
        if sheet_full_name not in self.config['sheet_settings']:
            self.config['sheet_settings'][sheet_full_name] = {}
        self.config['sheet_settings'][sheet_full_name]['param_row'] = int(row_idx)

    def get_sheet_custom_display(self, sheet_full_name):
        """獲取工作表的自定義顯示設定 (v3.14)"""
        settings = self.config['sheet_settings'].get(sheet_full_name, {})
        return settings.get('custom_display', None)

    def set_sheet_custom_display(self, sheet_full_name, config):
        """設定工作表的自定義顯示設定 (v3.14)"""
        if sheet_full_name not in self.config['sheet_settings']:
            self.config['sheet_settings'][sheet_full_name] = {}
        self.config['sheet_settings'][sheet_full_name]['custom_display'] = config

    def get_layout_settings(self):
        """獲取佈局設定"""
        return self.config.get('layout_settings', {})

    def set_layout_settings(self, h_sizes, v_sizes):
        """設定佈局設定"""
        self.config['layout_settings'] = {
            'h_splitter': h_sizes,
            'v_splitter': v_sizes
        }

    def get_global_font_size(self):
        return self.config.get('global_settings', {}).get('font_size', 10)

    def set_global_font_size(self, size):
        if 'global_settings' not in self.config: self.config['global_settings'] = {}
        self.config['global_settings']['font_size'] = size

    def get_preview_max_col_width(self):
        """右欄預覽欄寬上限（字數截斷門檻），預設 900。"""
        return self.config.get('global_settings', {}).get('preview_max_col_width', 900)

    def set_preview_max_col_width(self, width):
        if 'global_settings' not in self.config: self.config['global_settings'] = {}
        self.config['global_settings']['preview_max_col_width'] = int(width)

    def get_main_view_transform(self):
        return self.config.get('view_settings', {})

    def set_main_view_transform(self, matrix_tuple, center_point):
        self.config['view_settings'] = {
            'main_view_transform': matrix_tuple,
            'center_on': center_point
        }

    def get_hidden_fields(self, sheet_full_name):
        """獲取工作表的隱藏欄位列表"""
        settings = self.config['sheet_settings'].get(sheet_full_name, {})
        return settings.get('hidden_fields', [])

    def toggle_hidden_field(self, sheet_full_name, field_name):
        """切換欄位隱藏狀態"""
        if sheet_full_name not in self.config['sheet_settings']:
            self.config['sheet_settings'][sheet_full_name] = {}
        
        hidden = self.config['sheet_settings'][sheet_full_name].get('hidden_fields', [])
        if field_name in hidden:
            hidden.remove(field_name)
        else:
            hidden.append(field_name)
        
        self.config['sheet_settings'][sheet_full_name]['hidden_fields'] = hidden

    def save_window_state(self, w, h, m):
        self.config['window_state'] = {
            'width': w,
            'height': h,
            'maximized': m
        }
    
    # --- 工作目錄管理 (v3.11) ---
    
    def get_working_directory(self):
        """獲取已保存的工作目錄"""
        return self.config.get('working_directory')
    
    def set_working_directory(self, path):
        """設定並保存工作目錄"""
        self.config['working_directory'] = str(Path(path).resolve())
        self.save_config()
    
    def validate_working_directory(self, path=None):
        """驗證工作目錄是否有效
        
        Args:
            path: 要驗證的目錄路徑，若為 None 則驗證當前配置的目錄
            
        Returns:
            (bool, str): (是否有效, 錯誤訊息)
        """
        if path is None:
            path = self.get_working_directory()
        
        if not path:
            return False, "未設定工作目錄"
        
        path_obj = Path(path)
        
        if not path_obj.exists():
            return False, f"目錄不存在：{path}"
        
        if not path_obj.is_dir():
            return False, f"路徑不是目錄：{path}"
        
        # 檢查是否包含 Excel 檔案
        has_excel = any(path_obj.glob('*.xlsx')) or any(path_obj.glob('*.xls')) or any(path_obj.glob('*.xlsm'))
        
        if not has_excel:
            return False, f"目錄中未找到 Excel 檔案（.xlsx/.xls/.xlsm）：{path}"
        
        return True, ""

    # --- Arrow Visibility (v3.16) ---
    def get_arrow_visibility(self):
        """獲取箭頭可見性 (預設 True)"""
        return self.config.get('view_settings', {}).get('show_arrows', True)

    def set_arrow_visibility(self, visible):
        """設定箭頭可見性"""
        if 'view_settings' not in self.config:
            self.config['view_settings'] = {}
        self.config['view_settings']['show_arrows'] = visible
        self.save_config()
