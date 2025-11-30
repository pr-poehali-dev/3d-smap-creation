import { useEffect, useRef } from 'react';

interface Model3DViewerProps {
  vertices: number[][];
  faces: number[][];
  rotation: { x: number; y: number };
  zoom: number;
  segmentedImage: string;
}

const Model3DViewer = ({ vertices, faces, rotation, zoom, segmentedImage }: Model3DViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const scale = (Math.min(width, height) / 4) * (zoom / 100);

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
          z: newZ
        };
      });

      const sortedFaces = faces
        .map(face => {
          const v1 = transformedVertices[face[0]];
          const v2 = transformedVertices[face[1]];
          const v3 = transformedVertices[face[2]];
          
          const avgZ = (v1.z + v2.z + v3.z) / 3;
          
          return { face, avgZ, v1, v2, v3 };
        })
        .sort((a, b) => a.avgZ - b.avgZ);

      sortedFaces.forEach(({ v1, v2, v3, avgZ }) => {
        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.lineTo(v3.x, v3.y);
        ctx.closePath();

        const lightness = Math.max(0.3, Math.min(1, (avgZ + 1) / 2));
        const baseColor = [155, 135, 245];
        const r = Math.floor(baseColor[0] * lightness);
        const g = Math.floor(baseColor[1] * lightness);
        const b = Math.floor(baseColor[2] * lightness);
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fill();

        ctx.strokeStyle = `rgba(100, 100, 150, 0.3)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [vertices, faces, rotation, zoom]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={800}
        height={800}
        className="w-full h-full"
      />
      
      {segmentedImage && (
        <img
          src={segmentedImage}
          alt="Segmented"
          className="absolute inset-0 w-full h-full object-contain opacity-0 pointer-events-none"
          style={{ mixBlendMode: 'multiply' }}
        />
      )}
    </div>
  );
};

export default Model3DViewer;
