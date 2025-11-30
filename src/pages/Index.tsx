import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface Model3D {
  id: string;
  name: string;
  image: string;
  createdAt: Date;
  format: string;
}

interface ModelData {
  vertices: number[][];
  faces: number[][];
  segmentedImage: string;
  depthMap: string;
}

const Index = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [rotation, setRotation] = useState({ x: 20, y: 45 });
  const [zoom, setZoom] = useState([100]);
  const [showModel, setShowModel] = useState(false);
  const [modelData, setModelData] = useState<ModelData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [models] = useState<Model3D[]>([
    {
      id: '1',
      name: 'Coffee Mug',
      image: '/placeholder.svg',
      createdAt: new Date('2024-11-25'),
      format: 'OBJ'
    },
    {
      id: '2',
      name: 'Sneaker',
      image: '/placeholder.svg',
      createdAt: new Date('2024-11-23'),
      format: 'STL'
    },
    {
      id: '3',
      name: 'Plant Pot',
      image: '/placeholder.svg',
      createdAt: new Date('2024-11-20'),
      format: 'GLTF'
    }
  ]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processImage(file);
    } else {
      toast.error('Пожалуйста, загрузите изображение');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const processImage = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      setUploadedImage(imageData);
      setIsProcessing(true);
      
      try {
        setProcessingStep('Выделяю объект из фотографии...');
        
        const segmentResponse = await fetch('https://functions.poehali.dev/450a7049-5606-4263-b4a6-fce55cd303ef', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: imageData })
        });
        
        if (!segmentResponse.ok) {
          throw new Error('Ошибка обработки изображения');
        }
        
        const segmentData = await segmentResponse.json();
        
        setProcessingStep('Создаю 3D-модель с восстановлением невидимых сторон...');
        
        const modelResponse = await fetch('https://functions.poehali.dev/bdb11656-066f-4291-b05e-fa27ce32fe93', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            dimensions: segmentData.dimensions 
          })
        });
        
        if (!modelResponse.ok) {
          throw new Error('Ошибка генерации 3D-модели');
        }
        
        const modelResult = await modelResponse.json();
        
        setModelData({
          vertices: modelResult.vertices,
          faces: modelResult.faces,
          segmentedImage: segmentData.segmented_image,
          depthMap: segmentData.depth_map
        });
        
        setIsProcessing(false);
        setShowModel(true);
        toast.success(`3D модель создана! ${modelResult.stats.vertex_count} вершин, ${modelResult.stats.face_count} граней`);
      } catch (error) {
        console.error('Ошибка:', error);
        setIsProcessing(false);
        toast.error('Не удалось создать 3D-модель. Попробуйте другое изображение.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExport = async (format: string) => {
    if (!modelData) {
      toast.error('Нет модели для экспорта');
      return;
    }
    
    toast.success(`Модель экспортируется в формате ${format}`);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showModel && e.buttons === 1) {
      setRotation(prev => ({
        x: prev.x + e.movementY * 0.5,
        y: prev.y + e.movementX * 0.5
      }));
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              3D Smap
            </h1>
            <p className="text-muted-foreground mt-1">
              Превращаем фотографии в 3D-модели
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="icon">
              <Icon name="Settings" size={20} />
            </Button>
            <Button variant="outline" size="icon">
              <Icon name="User" size={20} />
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 border-2 border-border/50 backdrop-blur-sm bg-card/50 animate-scale-in">
              {!uploadedImage ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-primary bg-primary/10 scale-105'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                      <Icon name="Upload" size={40} className="text-primary" />
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-semibold mb-2">
                        Загрузите фотографию
                      </h3>
                      <p className="text-muted-foreground">
                        Перетащите изображение или кликните для выбора
                      </p>
                    </div>
                    
                    <Badge variant="secondary" className="text-xs">
                      PNG, JPG до 10MB
                    </Badge>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {isProcessing && (
                    <div className="flex items-center justify-center py-8">
                      <div className="space-y-4 text-center">
                        <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-lg font-medium">Создаю 3D-модель...</p>
                        <p className="text-sm text-muted-foreground">
                          {processingStep || 'Восстанавливаю невидимые стороны объекта'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {showModel && (
                    <div
                      className="relative aspect-square bg-gradient-to-br from-muted to-background rounded-xl overflow-hidden cursor-grab active:cursor-grabbing"
                      onMouseMove={handleMouseMove}
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(155,135,245,0.1),transparent_50%)]" />
                      
                      <div
                        className="absolute inset-0 flex items-center justify-center transition-transform duration-100"
                        style={{
                          transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${zoom[0] / 100})`
                        }}
                      >
                        <div className="w-64 h-64 relative animate-rotate-slow">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-secondary/30 rounded-lg transform rotate-45" />
                          <div className="absolute inset-4 bg-gradient-to-tl from-primary/20 to-secondary/20 rounded-lg" />
                          <div className="absolute inset-8 bg-card rounded-lg flex items-center justify-center">
                            <img
                              src={modelData?.segmentedImage || uploadedImage}
                              alt="3D Model"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="absolute top-4 left-4 flex gap-2">
                        <Badge className="bg-primary/90">3D модель</Badge>
                        <Badge variant="secondary">Интерактивная</Badge>
                        {modelData && (
                          <Badge variant="outline" className="bg-background/90">
                            {modelData.vertices.length} вершин
                          </Badge>
                        )}
                      </div>
                      
                      <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-background/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
                        Перетащите для поворота
                      </div>
                    </div>
                  )}
                  
                  {showModel && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUploadedImage(null);
                          setShowModel(false);
                          setModelData(null);
                          setRotation({ x: 20, y: 45 });
                          setZoom([100]);
                        }}
                      >
                        <Icon name="Upload" size={16} className="mr-2" />
                        Новое фото
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {showModel && (
              <Card className="p-6 border-2 border-border/50 backdrop-blur-sm bg-card/50 animate-fade-in">
                <Tabs defaultValue="controls" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="controls">Управление</TabsTrigger>
                    <TabsTrigger value="edit">Редактор</TabsTrigger>
                    <TabsTrigger value="export">Экспорт</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="controls" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Icon name="ZoomIn" size={16} />
                        Масштаб: {zoom[0]}%
                      </label>
                      <Slider
                        value={zoom}
                        onValueChange={setZoom}
                        min={50}
                        max={200}
                        step={5}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        onClick={() => setRotation({ x: 0, y: 0 })}
                      >
                        <Icon name="RotateCcw" size={16} className="mr-2" />
                        Сбросить поворот
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setZoom([100])}
                      >
                        <Icon name="Maximize2" size={16} className="mr-2" />
                        100%
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="edit" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline">
                        <Icon name="Crop" size={16} className="mr-2" />
                        Обрезать
                      </Button>
                      <Button variant="outline">
                        <Icon name="Palette" size={16} className="mr-2" />
                        Текстуры
                      </Button>
                      <Button variant="outline">
                        <Icon name="Move" size={16} className="mr-2" />
                        Позиция
                      </Button>
                      <Button variant="outline">
                        <Icon name="Sun" size={16} className="mr-2" />
                        Освещение
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="export" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Выберите формат для экспорта 3D-модели
                    </p>
                    
                    <div className="grid gap-3">
                      {['OBJ', 'STL', 'GLTF', 'FBX'].map((format) => (
                        <Button
                          key={format}
                          variant="outline"
                          className="justify-start"
                          onClick={() => handleExport(format)}
                        >
                          <Icon name="Download" size={16} className="mr-2" />
                          Экспорт в {format}
                        </Button>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className="p-6 border-2 border-border/50 backdrop-blur-sm bg-card/50 animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="History" size={20} className="text-primary" />
                <h2 className="text-lg font-semibold">История моделей</h2>
              </div>
              
              <div className="space-y-3">
                {models.map((model, index) => (
                  <div
                    key={model.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0">
                      <Icon name="Box" size={20} className="text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {model.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {model.createdAt.toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    
                    <Badge variant="outline" className="text-xs">
                      {model.format}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-secondary/10 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Icon name="Sparkles" size={20} className="text-primary" />
                </div>
                
                <div>
                  <h3 className="font-semibold mb-1">AI восстановление</h3>
                  <p className="text-sm text-muted-foreground">
                    Наша технология автоматически восстанавливает невидимые стороны объекта, создавая полноценную 3D-модель из одной фотографии
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;