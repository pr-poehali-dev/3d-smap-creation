import json
import base64
from typing import Dict, Any
from io import BytesIO
from PIL import Image, ImageFilter, ImageOps

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Обработка изображения - выделение объекта и подготовка для 3D
    Args: event с httpMethod, body (base64 изображение)
          context с request_id
    Returns: HTTP response с выделенным объектом
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
    image_data = body_data.get('image', '')
    
    if not image_data:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'No image provided'})
        }
    
    if ',' in image_data:
        image_data = image_data.split(',')[1]
    
    img_bytes = base64.b64decode(image_data)
    img = Image.open(BytesIO(img_bytes))
    
    img = img.convert('RGBA')
    
    img_gray = img.convert('L')
    edges = img_gray.filter(ImageFilter.FIND_EDGES)
    edges = edges.point(lambda x: 0 if x < 50 else 255)
    
    mask = img_gray.point(lambda x: 255 if x > 30 else 0)
    mask = mask.filter(ImageFilter.GaussianBlur(2))
    
    segmented = Image.new('RGBA', img.size, (0, 0, 0, 0))
    segmented.paste(img, mask=mask)
    
    output = BytesIO()
    segmented.save(output, format='PNG')
    output.seek(0)
    
    result_base64 = base64.b64encode(output.read()).decode('utf-8')
    
    width, height = img.size
    aspect_ratio = width / height
    
    depth_map = img_gray.filter(ImageFilter.GaussianBlur(5))
    depth_output = BytesIO()
    depth_map.save(depth_output, format='PNG')
    depth_output.seek(0)
    depth_base64 = base64.b64encode(depth_output.read()).decode('utf-8')
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'isBase64Encoded': False,
        'body': json.dumps({
            'segmented_image': f'data:image/png;base64,{result_base64}',
            'depth_map': f'data:image/png;base64,{depth_base64}',
            'dimensions': {
                'width': width,
                'height': height,
                'aspect_ratio': aspect_ratio
            },
            'status': 'success',
            'message': 'Объект успешно выделен и подготовлен для 3D'
        })
    }
