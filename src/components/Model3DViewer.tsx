import { useEffect, useRef, useState } from 'react';

interface Model3DViewerProps {
  vertices: number[][];
  faces: number[][];
  rotation: { x: number; y: number };
  zoom: number;
  segmentedImage: string;
}

const Model3DViewer = ({ vertices, faces, rotation, zoom, segmentedImage }: Model3DViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [texture, setTexture] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (segmentedImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setTexture(img);
      img.src = segmentedImage;
    }
  }, [segmentedImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !texture) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const scale = (Math.min(width, height) / 3) * (zoom / 100);

      const radX = (rotation.x * Math.PI) / 180;
      const radY = (rotation.y * Math.PI) / 180;

      const cosX = Math.cos(radX);
      const sinX = Math.sin(radX);
      const cosY = Math.cos(radY);
      const sinY = Math.sin(radY);

      const transformedVertices = vertices.map(([x, y, z]) => {
        const newY = y * cosX - z * sinX;
        let newZ = y * sinX + z * cosX;

        const newX = x * cosY + newZ * sinY;
        newZ = -x * sinY + newZ * cosY;

        return {
          x: newX * scale + centerX,
          y: newY * scale + centerY,
          z: newZ,
          origX: x,
          origY: y,
          origZ: z
        };
      });

      const sortedFaces = faces
        .map(face => {
          const v1 = transformedVertices[face[0]];
          const v2 = transformedVertices[face[1]];
          const v3 = transformedVertices[face[2]];
          
          const avgZ = (v1.z + v2.z + v3.z) / 3;
          
          const nx = (v2.y - v1.y) * (v3.z - v1.z) - (v2.z - v1.z) * (v3.y - v1.y);
          const ny = (v2.z - v1.z) * (v3.x - v1.x) - (v2.x - v1.x) * (v3.z - v1.z);
          const nz = (v2.x - v1.x) * (v3.y - v1.y) - (v2.y - v1.y) * (v3.x - v1.x);
          
          const backfacing = nz < 0;
          
          return { face, avgZ, v1, v2, v3, backfacing };
        })
        .filter(f => !f.backfacing)
        .sort((a, b) => a.avgZ - b.avgZ);

      sortedFaces.forEach(({ v1, v2, v3, avgZ }) => {
        ctx.save();
        
        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.lineTo(v3.x, v3.y);
        ctx.closePath();
        ctx.clip();

        const u1 = (v1.origX + 1) / 2;
        const v1y = (1 - v1.origY) / 2;
        const u2 = (v2.origX + 1) / 2;
        const v2y = (1 - v2.origY) / 2;
        const u3 = (v3.origX + 1) / 2;
        const v3y = (1 - v3.origY) / 2;

        const tx1 = u1 * texture.width;
        const ty1 = v1y * texture.height;
        const tx2 = u2 * texture.width;
        const ty2 = v2y * texture.height;
        const tx3 = u3 * texture.width;
        const ty3 = v3y * texture.height;

        const x1 = v1.x, y1 = v1.y;
        const x2 = v2.x, y2 = v2.y;
        const x3 = v3.x, y3 = v3.y;

        const det = (tx2 - tx1) * (ty3 - ty1) - (tx3 - tx1) * (ty2 - ty1);
        
        if (Math.abs(det) > 0.01) {
          const a = ((x2 - x1) * (ty3 - ty1) - (x3 - x1) * (ty2 - ty1)) / det;
          const b = ((tx2 - tx1) * (x3 - x1) - (tx3 - tx1) * (x2 - x1)) / det;
          const c = x1 - a * tx1 - b * ty1;
          const d = ((y2 - y1) * (ty3 - ty1) - (y3 - y1) * (ty2 - ty1)) / det;
          const e = ((tx2 - tx1) * (y3 - y1) - (tx3 - tx1) * (y2 - y1)) / det;
          const f = y1 - d * tx1 - e * ty1;

          ctx.transform(a, d, b, e, c, f);
          ctx.drawImage(texture, 0, 0);
        }

        ctx.restore();

        const lightness = Math.max(0.6, Math.min(1, (avgZ + 1) / 1.5));
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `rgba(${Math.floor(255 * lightness)}, ${Math.floor(255 * lightness)}, ${Math.floor(255 * lightness)}, 0.3)`;
        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.lineTo(v3.x, v3.y);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        ctx.strokeStyle = `rgba(0, 0, 0, 0.1)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });
    };

    render();

  }, [vertices, faces, rotation, zoom, texture]);

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-background/50 to-muted/30">
      <canvas
        ref={canvasRef}
        width={1000}
        height={1000}
        className="w-full h-full"
      />
    </div>
  );
};

export default Model3DViewer;
