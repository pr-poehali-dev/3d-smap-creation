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
    edges_enhanced = edges.point(lambda x: 255 if x > 30 else 0)
    
    from PIL import ImageChops, ImageEnhance
    contrast = ImageEnhance.Contrast(img_gray)
    high_contrast = contrast.enhance(2.0)
    
    threshold = 80
    binary = high_contrast.point(lambda x: 255 if x > threshold else 0)
    
    kernel_size = 5
    dilated = binary.filter(ImageFilter.MaxFilter(kernel_size))
    eroded = dilated.filter(ImageFilter.MinFilter(kernel_size))
    
    mask = eroded.filter(ImageFilter.GaussianBlur(3))
    
    mask_array = mask.load()
    width, height = mask.size
    for y in range(height):
        for x in range(width):
            if mask_array[x, y] < 128:
                mask_array[x, y] = 0
            else:
                mask_array[x, y] = 255
    
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