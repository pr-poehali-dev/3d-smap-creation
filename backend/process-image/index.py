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
    width, height = img.size
    
    img_gray = img.convert('L')
    
    from PIL import ImageEnhance, ImageChops, ImageDraw
    import numpy as np
    
    contrast = ImageEnhance.Contrast(img_gray)
    high_contrast = contrast.enhance(2.5)
    
    edges = high_contrast.filter(ImageFilter.FIND_EDGES)
    edges = edges.filter(ImageFilter.MaxFilter(3))
    
    pixels = np.array(high_contrast)
    
    threshold = np.percentile(pixels, 15)
    
    mask_pixels = (pixels > threshold).astype(np.uint8) * 255
    
    from scipy import ndimage
    labeled, num_features = ndimage.label(mask_pixels)
    
    if num_features > 0:
        component_sizes = [(i, np.sum(labeled == i)) for i in range(1, num_features + 1)]
        component_sizes.sort(key=lambda x: x[1], reverse=True)
        
        largest_component = component_sizes[0][0]
        mask_pixels = (labeled == largest_component).astype(np.uint8) * 255
    
    struct = ndimage.generate_binary_structure(2, 2)
    mask_pixels = ndimage.binary_closing(mask_pixels, structure=struct, iterations=3).astype(np.uint8) * 255
    mask_pixels = ndimage.binary_opening(mask_pixels, structure=struct, iterations=2).astype(np.uint8) * 255
    
    mask = Image.fromarray(mask_pixels)
    mask = mask.filter(ImageFilter.GaussianBlur(2))
    
    segmented = Image.new('RGBA', img.size, (0, 0, 0, 0))
    segmented.paste(img, mask=mask)
    
    output = BytesIO()
    segmented.save(output, format='PNG')
    output.seek(0)
    
    result_base64 = base64.b64encode(output.read()).decode('utf-8')
    
    aspect_ratio = width / height
    
    depth_pixels = np.array(img_gray).astype(float)
    depth_pixels = ndimage.gaussian_filter(depth_pixels, sigma=3)
    
    mask_array = np.array(mask)
    depth_pixels = depth_pixels * (mask_array / 255.0)
    
    depth_pixels = (depth_pixels - depth_pixels.min()) / (depth_pixels.max() - depth_pixels.min() + 1e-8) * 255
    
    depth_map = Image.fromarray(depth_pixels.astype(np.uint8))
    depth_output = BytesIO()
    depth_map.save(depth_output, format='PNG')
    depth_output.seek(0)
    depth_base64 = base64.b64encode(depth_output.read()).decode('utf-8')
    
    mask_output = BytesIO()
    mask.save(mask_output, format='PNG')
    mask_output.seek(0)
    mask_base64 = base64.b64encode(mask_output.read()).decode('utf-8')
    
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
            'mask': f'data:image/png;base64,{mask_base64}',
            'dimensions': {
                'width': width,
                'height': height,
                'aspect_ratio': aspect_ratio
            },
            'status': 'success',
            'message': 'Объект успешно выделен и подготовлен для 3D'
        })
    }