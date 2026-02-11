#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
驗證腳本：檢查 Slicer 範例的關聯路徑
"""

import json
from pathlib import Path

def verify_slicer_path():
    """驗證 Slicer 角色的關聯路徑"""
    current_dir = Path(__file__).parent
    graph_file = current_dir / 'relationship_graph.json'
    
    with open(graph_file, 'r', encoding='utf-8') as f:
        graph_data = json.load(f)
    
    nodes = {node['id']: node for node in graph_data['nodes']}
    edges = graph_data['edges']
    
    # 建立節點名稱到 ID 的映射
    name_to_id = {}
    for node_id, node in nodes.items():
        full_name = f"{node['table']}.{node['sheet']}"
        name_to_id[full_name] = node_id
    
    print("=== Verifying Slicer Example Path ===\n")
    print("Expected path:")
    print("  Slicer -> Skill_Slicer -> SpawnedObject_SlicerLeaf")
    print("  -> Skill_SlicerLeaf -> Damage & Effect\n")
    
    # 檢查各個節點是否存在
    key_nodes = [
        'Skill.Skill_Slicer',
        'SpawnedObject.SpawnedObject_SlicerLeaf',
        'Skill.Skill_SlicerLeaf',
        'Damage.Damage',
        'Effect.Effect'
    ]
    
    print("Checking nodes:")
    found_nodes = {}
    for node_name in key_nodes:
        if node_name in name_to_id:
            node_id = name_to_id[node_name]
            print(f"  OK {node_name} (ID: {node_id})")
            found_nodes[node_name] = node_id
        else:
            print(f"  X {node_name} NOT FOUND")
    
    # 檢查關聯邊
    print("\nChecking relationships:")
    
    def find_edges_from(from_id):
        return [e for e in edges if e['from'] == from_id]
    
    def find_edges_to(to_id):
        return [e for e in edges if e['to'] == to_id]
    
    # Skill_Slicer 的關聯
    if 'Skill.Skill_Slicer' in found_nodes:
        slicer_id = found_nodes['Skill.Skill_Slicer']
        slicer_edges = find_edges_from(slicer_id)
        print(f"\n  From Skill_Slicer:")
        for edge in slicer_edges:
            to_node = nodes[edge['to']]
            print(f"    -> {to_node['table']}.{to_node['sheet']} ({edge['type']})")
    
    # SpawnedObject_SlicerLeaf 的關聯
    if 'SpawnedObject.SpawnedObject_SlicerLeaf' in found_nodes:
        leaf_id = found_nodes['SpawnedObject.SpawnedObject_SlicerLeaf']
        leaf_edges = find_edges_from(leaf_id)
        print(f"\n  From SpawnedObject_SlicerLeaf:")
        for edge in leaf_edges:
            to_node = nodes[edge['to']]
            print(f"    -> {to_node['table']}.{to_node['sheet']} ({edge['type']})")
    
    # Skill_SlicerLeaf 的關聯
    if 'Skill.Skill_SlicerLeaf' in found_nodes:
        slicerleaf_id = found_nodes['Skill.Skill_SlicerLeaf']
        slicerleaf_edges = find_edges_from(slicerleaf_id)
        print(f"\n  From Skill_SlicerLeaf:")
        for edge in slicerleaf_edges:
            to_node = nodes[edge['to']]
            print(f"    -> {to_node['table']}.{to_node['sheet']} ({edge['type']}, column: {edge.get('column', 'N/A')})")
    
    print("\n=== Verification Complete ===")

if __name__ == '__main__':
    verify_slicer_path()
