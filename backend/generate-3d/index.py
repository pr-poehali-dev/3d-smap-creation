import json
import base64
from typing import Dict, Any
import math
from PIL import Image
from io import BytesIO

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Генерация 3D-модели из выделенного объекта с карой глубины
    Args: event с httpMethod, body (изображение, depth map)
          context с request_id
    Returns: HTTP response с данными 3D-модели (vertices, faces)
    '''
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    body_data = json.loads(event.get('body', '{}'))
    dimensions = body_data.get('dimensions', {'width': 100, 'height': 100})
    depth_map_data = body_data.get('depth_map', '')
    
    width = dimensions.get('width', 100)
    height = dimensions.get('height', 100)
    
    vertices = []
    faces = []
    normals = []
    uvs = []
    
    grid_size = 40
    depth_scale = 0.5
    
    depth_values = []
    if depth_map_data:
        try:
            if ',' in depth_map_data:
                depth_map_data = depth_map_data.split(',')[1]
            depth_bytes = base64.b64decode(depth_map_data)
            depth_img = Image.open(BytesIO(depth_bytes)).convert('L')
            depth_img = depth_img.resize((grid_size + 1, grid_size + 1))
            for i in range(grid_size + 1):
                row = []
                for j in range(grid_size + 1):
                    pixel_value = depth_img.getpixel((j, i))
                    normalized = pixel_value / 255.0
                    row.append(normalized)
                depth_values.append(row)
        except:
            depth_values = [[0.5 for _ in range(grid_size + 1)] for _ in range(grid_size + 1)]
    else:
        depth_values = [[0.5 for _ in range(grid_size + 1)] for _ in range(grid_size + 1)]
    
    for i in range(grid_size + 1):
        for j in range(grid_size + 1):
            x = (j / grid_size - 0.5) * 2
            y = (0.5 - i / grid_size) * 2
            
            depth = depth_values[i][j]
            z_front = depth * depth_scale
            
            vertices.append([x, y, z_front])
            normals.append([0, 0, 1])
            uvs.append([j / grid_size, i / grid_size])
    
    for i in range(grid_size):
        for j in range(grid_size):
            idx = i * (grid_size + 1) + j
            
            v1 = idx
            v2 = idx + 1
            v3 = idx + grid_size + 1
            v4 = idx + grid_size + 2
            
            faces.append([v1, v2, v3])
            faces.append([v2, v4, v3])
    
    back_offset = len(vertices)
    back_depth = -0.15
    for i in range(grid_size + 1):
        for j in range(grid_size + 1):
            x = (j / grid_size - 0.5) * 2
            y = (0.5 - i / grid_size) * 2
            
            depth = depth_values[i][j]
            z_back = depth * depth_scale + back_depth
            
            vertices.append([x, y, z_back])
            normals.append([0, 0, -1])
            uvs.append([j / grid_size, i / grid_size])
    
    for i in range(grid_size):
        for j in range(grid_size):
            idx = back_offset + i * (grid_size + 1) + j
            
            v1 = idx
            v2 = idx + 1
            v3 = idx + grid_size + 1
            v4 = idx + grid_size + 2
            
            faces.append([v1, v3, v2])
            faces.append([v2, v3, v4])
    
    side_offset = len(vertices)
    for i in range(grid_size + 1):
        front_idx = i * (grid_size + 1)
        back_idx = back_offset + i * (grid_size + 1)
        
        vertices.append(vertices[front_idx])
        vertices.append(vertices[back_idx])
        normals.append([-1, 0, 0])
        normals.append([-1, 0, 0])
    
    for i in range(grid_size + 1):
        front_idx = i * (grid_size + 1) + grid_size
        back_idx = back_offset + i * (grid_size + 1) + grid_size
        
        vertices.append(vertices[front_idx])
        vertices.append(vertices[back_idx])
        normals.append([1, 0, 0])
        normals.append([1, 0, 0])
    
    obj_content = "# 3D Smap Generated Model\n\n"
    
    for v in vertices:
        obj_content += f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n"
    
    for n in normals:
        obj_content += f"vn {n[0]:.6f} {n[1]:.6f} {n[2]:.6f}\n"
    
    for f in faces:
        obj_content += f"f {f[0]+1}//{f[0]+1} {f[1]+1}//{f[1]+1} {f[2]+1}//{f[2]+1}\n"
    
    obj_base64 = base64.b64encode(obj_content.encode()).decode('utf-8')
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'isBase64Encoded': False,
        'body': json.dumps({
            'vertices': vertices,
            'faces': faces,
            'normals': normals,
            'obj_file': obj_base64,
            'stats': {
                'vertex_count': len(vertices),
                'face_count': len(faces),
                'format': 'OBJ'
            },
            'status': 'success',
            'message': '3D-модель успешно сгенерирована'
        })
    }