#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
關聯分析器
基於 Excel 結構資料建立表格之間的關聯圖
"""

import json
from pathlib import Path
from collections import defaultdict
import re

class RelationshipAnalyzer:
    def __init__(self, structure_file):
        self.structure_file = Path(structure_file)
        self.tables = {}
        self.nodes = []
        self.edges = []
        self.graph = {
            'nodes': [],
            'edges': []
        }
        
    def load_structure(self):
        """載入 Excel 結構資料"""
        with open(self.structure_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            self.tables = data.get('tables', {})
        print(f"Loaded {len(self.tables)} tables from structure file")
    
    def build_graph(self):
        """建立關聯圖"""
        print("\nBuilding relationship graph...")
        
        # 建立節點（每個工作表是一個節點）
        # node_id = 0  <-- Removed sequential ID
        sheet_to_node = {}  # 映射 "TableName.SheetName" -> node object (Changed from ID)
        
        for table_name, table_data in self.tables.items():
            for sheet_name in table_data['sheets'].keys():
                # 過濾掉以 # 開頭的工作表（參考表、列舉等）
                if sheet_name.startswith('#'):
                    continue
                
                full_name = f"{table_name}.{sheet_name}"
                
                # 使用 Hash 作為 ID (Stable ID)
                import hashlib
                hash_object = hashlib.md5(full_name.encode())
                node_id = int(hash_object.hexdigest()[:8], 16)
                
                # 判斷節點類型
                node_type = self._classify_node(table_name, sheet_name)
                
                node = {
                    'id': node_id,
                    'table': table_name,
                    'sheet': sheet_name,
                    'full_name': full_name,
                    'type': node_type,
                    'filename': table_data['filename'],
                    'headers': table_data['sheets'][sheet_name]['headers'],
                    'row_count': table_data['sheets'][sheet_name]['row_count']
                }
                
                self.nodes.append(node)
                sheet_to_node[full_name] = node
        
        print(f"Created {len(self.nodes)} nodes")
        
        # 建立邊（關聯關係）
        self._detect_naming_relationships(sheet_to_node)
        self._detect_id_reference_relationships(sheet_to_node)
        self._detect_value_reference_relationships(sheet_to_node)
        
        print(f"Created {len(self.edges)} edges")

        # 組裝最終圖結構
        self.graph = {
            'nodes': self.nodes,
            'edges': self.edges,
            'metadata': {
                'total_tables': len(self.tables),
                'total_sheets': len(self.nodes),
                'total_relationships': len(self.edges)
            }
        }
    
    def _classify_node(self, table_name, sheet_name):
        """分類節點類型，用於視覺化時著色"""
        if sheet_name.startswith('#'):
            return 'enum'  # 列舉或參考表
        
        keywords = {
            'Skill': 'skill',
            'Damage': 'damage',
            'Effect': 'effect',
            'SpawnedObject': 'spawned_object',
            'Building': 'building',
            'Kaiju': 'kaiju',
            'Item': 'item',
            'Melee': 'melee'
        }
        
        for keyword, node_type in keywords.items():
            if keyword in table_name or keyword in sheet_name:
                return node_type
        
        return 'other'
    
    def _detect_naming_relationships(self, sheet_to_node):
        """偵測基於命名規則的關聯"""
        # 規則: TableName_SpecificName 工作表關聯到 TableName 的主工作表
        for node in self.nodes:
            table_name = node['table']
            sheet_name = node['sheet']
            
            # 如果工作表名稱包含下劃線，嘗試找到父表格
            if '_' in sheet_name and not sheet_name.startswith('#'):
                # 提取可能的父表格名稱
                parts = sheet_name.split('_')
                
                # 檢查第一部分是否對應某個表格
                potential_parent_table = parts[0]
                
                # 在同一個檔案中尋找父工作表
                parent_full_name = f"{table_name}.{potential_parent_table}"
                if parent_full_name in sheet_to_node:
                    parent_node = sheet_to_node[parent_full_name]
                    edge = {
                        'from': parent_node['id'],
                        'to': node['id'],
                        'type': 'naming_hierarchy',
                        'label': 'inherits'
                    }
                    self.edges.append(edge)
    
    def _detect_id_reference_relationships(self, sheet_to_node):
        """
        偵測欄位關聯 (Greedy Substring Match)
        規則: 若欄位名稱包含其他表格的工作表名稱 (Greedy Match: 最長匹配優先)，則建立關聯。
        """
        # 準備目標工作表清單
        target_nodes = []
        for name, node in sheet_to_node.items():
            # node is now the object
            target_nodes.append({
                'id': node['id'],
                'sheet': node['sheet'],
                'full_name': node['full_name']
            })
            
        # 根據 Sheet Name 長度排序 (由長到短)，確保 Greedy Match
        target_nodes.sort(key=lambda x: len(x['sheet']), reverse=True)
        
        # 遍歷所有節點的欄位
        for node in self.nodes:
            headers = node['headers']
            if not headers: continue
            
            for header in headers:
                # 排除空標題
                if not header: continue
                
                # 對每個 Header，尋找最長匹配的 Target Sheet
                matched_target = None
                
                for target in target_nodes:
                    # 避免自己連自己
                    if target['id'] == node['id']:
                        continue
                        
                    # 檢查 Header 是否包含 Target Sheet Name
                    if target['sheet'] in header:
                        matched_target = target
                        break # 找到最長匹配，停止搜尋 (Greedy)
                
                if matched_target:
                    # 建立關聯
                    edge = {
                        'from': node['id'],
                        'to': matched_target['id'],
                        'type': 'string_reference',
                        'label': header, # 標示是哪個欄位觸發的
                        'column': header
                    }
                    
                    if not self._edge_exists(edge):
                        self.edges.append(edge)
    
    def _detect_value_reference_relationships(self, sheet_to_node):
        """
        偵測值內容關聯
        規則: 若欄位樣本值包含其他表格的工作表名稱 (Greedy Match)，則建立關聯。
        """
        # 準備目標工作表清單
        target_nodes = []
        for name, node in sheet_to_node.items():
            target_nodes.append({
                'id': node['id'],
                'sheet': node['sheet'],
                'full_name': node['full_name']
            })
        target_nodes.sort(key=lambda x: len(x['sheet']), reverse=True)
        
        for node in self.nodes:
            table_name = node['table']
            sheet_name = node['sheet']
            
            # 取得該 Sheet 的欄位資料
            if table_name not in self.tables: continue
            sheet_data = self.tables[table_name]['sheets'].get(sheet_name)
            if not sheet_data: continue
            columns = sheet_data.get('columns', {})
            
            for header, col_data in columns.items():
                samples = col_data.get('samples', [])
                if not samples: continue
                
                # 檢查每個樣本值
                for val in samples:
                    val_str = str(val)
                    matched_target = None
                    
                    for target in target_nodes:
                        if target['id'] == node['id']: continue
                        
                        # 檢查值是否包含 Target Sheet Name
                        if target['sheet'] in val_str:
                            matched_target = target
                            break # Greedy
                            
                    if matched_target:
                        edge = {
                            'from': node['id'],
                            'to': matched_target['id'],
                            'type': 'value_reference',
                            'label': f"{header}: {val_str}",
                            'column': header
                        }
                        if not self._edge_exists(edge):
                            self.edges.append(edge)
                        break # 該欄位只要有一個樣本匹配就夠了，避免重複過多

    
    def _edge_exists(self, new_edge):
        """檢查邊是否已存在"""
        for edge in self.edges:
            if edge['from'] == new_edge['from'] and edge['to'] == new_edge['to']:
                return True
        return False
    
    def save_graph(self, output_file):
        """儲存關聯圖為 JSON"""
        output_path = Path(output_file)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.graph, f, ensure_ascii=False, indent=2)
        
        print(f"\nGraph saved to: {output_path}")
        self.print_statistics()
    
    def print_statistics(self):
        """印出統計資訊"""
        print("\n=== Graph Statistics ===")
        print(f"Total nodes: {len(self.nodes)}")
        print(f"Total edges: {len(self.edges)}")
        
        # 統計節點類型
        type_counts = defaultdict(int)
        for node in self.nodes:
            type_counts[node['type']] += 1
        
        print("\nNode types:")
        for node_type, count in sorted(type_counts.items()):
            print(f"  {node_type}: {count}")
        
        # 統計邊類型
        edge_type_counts = defaultdict(int)
        for edge in self.edges:
            edge_type_counts[edge['type']] += 1
        
        print("\nEdge types:")
        for edge_type, count in sorted(edge_type_counts.items()):
            print(f"  {edge_type}: {count}")

def analyze_relationships(app_dir_path):
    """Wrapper for external calls"""
    # app_dir_path is where the GUI expects the files to be
    app_dir = Path(app_dir_path)
    
    # Input: Generated by previous step in the same directory
    structure_file = app_dir / 'excel_structure.json'
    
    # Output: Read by GUI from this directory
    output_file = app_dir / 'relationship_graph.json'
    
    print(f"Reading Structure: {structure_file}")
    print(f"Writing Graph: {output_file}")
    
    if not structure_file.exists():
        print(f"Error: Structure file not found at {structure_file}")
        return

    analyzer = RelationshipAnalyzer(structure_file)
    analyzer.load_structure()
    analyzer.build_graph()
    analyzer.save_graph(output_file)

def main():
    current_dir = Path(__file__).parent
    analyze_relationships(current_dir)

if __name__ == '__main__':
    main()
