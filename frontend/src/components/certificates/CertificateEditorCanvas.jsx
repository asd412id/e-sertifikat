import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Stage, Layer, Text, Image as KonvaImage, Transformer, Rect, Group, Circle, RegularPolygon } from 'react-konva';

const CertificateEditorCanvas = ({
  stageSize,
  setStageRef,
  lastPointerPosRef,
  transformerRef,
  shapeRefs,
  backgroundImageObj,
  backgroundImageRef,
  elements,
  selectedElement,
  imageCache,
  qrPreviewCache,
  lockImageRatio,
  handleSelectElement,
  handleUpdateElement,
  setSelectedElement,
  setSelectedElementIds,
  setTextProperties
}) => {
  return (
    <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#f8fafc', borderRadius: 2, p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
        Preview Sertifikat
      </Typography>
      <Paper
        elevation={3}
        sx={{
          p: 3,
          display: 'inline-block',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          ref={setStageRef}
          style={{ border: '2px solid #e0e0e0', background: 'white', borderRadius: '8px' }}
          onMouseMove={(e) => {
            const stage = e.target.getStage();
            const p = stage?.getPointerPosition?.();
            if (p && typeof p.x === 'number' && typeof p.y === 'number') {
              lastPointerPosRef.current = p;
            }
          }}
          onMouseDown={(e) => {
            const stage = e.target.getStage();
            const p = stage?.getPointerPosition?.();
            if (p && typeof p.x === 'number' && typeof p.y === 'number') {
              lastPointerPosRef.current = p;
            }
            const tr = transformerRef.current;
            if (tr && (e.target === tr || e.target.getParent() === tr)) return;
            const clickedNode = e.target;
            const elementNodes = Object.values(shapeRefs.current || {});
            const clickedOnElement = elementNodes.some(node => node === clickedNode || (node.findOne && node.findOne(`#${clickedNode.id()}`)));
            const clickedOnBackground = backgroundImageRef.current && clickedNode === backgroundImageRef.current;
            if (!clickedOnElement || clickedOnBackground || clickedNode === stage) {
              setSelectedElement(null);
              setSelectedElementIds([]);
              if (tr) {
                tr.nodes([]);
                tr.getLayer() && tr.getLayer().batchDraw();
              }
            }
          }}
          onTouchStart={(e) => {
            const stage = e.target.getStage();
            const p = stage?.getPointerPosition?.();
            if (p && typeof p.x === 'number' && typeof p.y === 'number') {
              lastPointerPosRef.current = p;
            }
          }}
        >
          <Layer>
            {backgroundImageObj && (
              <KonvaImage
                image={backgroundImageObj}
                x={0}
                y={0}
                width={stageSize.width}
                height={stageSize.height}
                ref={backgroundImageRef}
              />
            )}

            {elements.map((element) => (
              <React.Fragment key={element.id}>
                {element.type === 'text' ? (
                  <>
                    {element.bgColor && (
                      <Rect
                        x={(element.x || 0) - (element.bgPadding || 0)}
                        y={(element.y || 0) - (element.bgPadding || 0)}
                        width={(element.width || 200) + 2 * (element.bgPadding || 0)}
                        height={(element.fontSize ? element.fontSize * (element.lineHeight || 1) : 32) + 2 * (element.bgPadding || 0)}
                        fill={element.bgColor}
                        cornerRadius={element.bgRadius || 0}
                        listening={false}
                      />
                    )}
                    <Text
                      x={element.x || 0}
                      y={element.y || 0}
                      text={element.text}
                      fontSize={element.fontSize}
                      fontFamily={element.fontFamily}
                      fill={element.fill}
                      fontStyle={`${element.fontStyle === 'italic' ? 'italic' : 'normal'} ${element.fontWeight === 'bold' ? 'bold' : 'normal'}`.trim()}
                      textDecoration={element.textDecoration}
                      letterSpacing={typeof element.letterSpacing === 'number' ? element.letterSpacing : 0}
                      align={element.align || 'left'}
                      width={element.width || 200}
                      lineHeight={element.lineHeight || 1}
                      wrap={element.wordWrap === false ? 'none' : 'word'}
                      rotation={element.rotation || 0}
                      ref={(node) => { if (node) shapeRefs.current[element.id] = node; }}
                      shadowColor={element.shadowColor || 'rgba(0,0,0,0)'}
                      shadowBlur={element.shadowBlur || 0}
                      shadowOffset={{ x: element.shadowOffsetX || 0, y: element.shadowOffsetY || 0 }}
                      shadowOpacity={typeof element.shadowOpacity === 'number' ? element.shadowOpacity : 1}
                      draggable={element.draggable}
                      onClick={(e) => handleSelectElement(element, e)}
                      onDragEnd={(e) => {
                        handleUpdateElement(element.id, { x: e.target.x(), y: e.target.y() });
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target;
                        const scaleX = node.scaleX();
                        const scaleY = node.scaleY();
                        const prevWidth = element.width || 200;
                        const prevFontSize = element.fontSize || 24;
                        const newWidth = Math.max(50, prevWidth * scaleX);
                        const newFontSize = Math.max(6, Math.round(prevFontSize * scaleY));
                        handleUpdateElement(element.id, {
                          x: node.x(),
                          y: node.y(),
                          width: newWidth,
                          fontSize: newFontSize,
                          rotation: node.rotation()
                        });
                        setTextProperties((prev) => ({
                          ...prev,
                          width: newWidth,
                          fontSize: newFontSize
                        }));
                        node.scaleX(1);
                        node.scaleY(1);
                      }}
                    />
                  </>
                ) : element.type === 'qrcode' ? (
                  <Group
                    x={element.x || 0}
                    y={element.y || 0}
                    rotation={element.rotation || 0}
                    ref={(node) => { if (node) shapeRefs.current[element.id] = node; }}
                    draggable={element.draggable}
                    onClick={(e) => handleSelectElement(element, e)}
                    onDragEnd={(e) => {
                      handleUpdateElement(element.id, { x: e.target.x(), y: e.target.y() });
                    }}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      const newWidth = Math.max(5, (element.width || 120) * scaleX);
                      const newHeight = Math.max(5, (element.height || 120) * scaleY);
                      handleUpdateElement(element.id, {
                        x: node.x(),
                        y: node.y(),
                        width: newWidth,
                        height: newHeight,
                        rotation: node.rotation()
                      });
                      node.scaleX(1);
                      node.scaleY(1);
                    }}
                    shadowColor={element.shadowColor || 'rgba(0,0,0,0)'}
                    shadowBlur={element.shadowBlur || 0}
                    shadowOffset={{ x: element.shadowOffsetX || 0, y: element.shadowOffsetY || 0 }}
                    shadowOpacity={typeof element.shadowOpacity === 'number' ? element.shadowOpacity : 1}
                  >
                    <Group
                      clipFunc={(ctx) => {
                        const w = element.width || 120;
                        const h = element.height || 120;
                        const r = Math.min(element.borderRadius || 0, w / 2, h / 2);
                        if (!r) {
                          ctx.rect(0, 0, w, h);
                          return;
                        }
                        ctx.beginPath();
                        ctx.moveTo(r, 0);
                        ctx.arcTo(w, 0, w, h, r);
                        ctx.arcTo(w, h, 0, h, r);
                        ctx.arcTo(0, h, 0, 0, r);
                        ctx.arcTo(0, 0, w, 0, r);
                        ctx.closePath();
                      }}
                    >
                      <Rect
                        x={0}
                        y={0}
                        width={element.width || 120}
                        height={element.height || 120}
                        fill={element.transparentBackground ? 'rgba(0,0,0,0)' : (element.backgroundColor || '#ffffff')}
                        stroke={element.borderColor || '#111827'}
                        strokeWidth={Math.max(0, element.borderWidth || 0)}
                        cornerRadius={element.borderRadius || 0}
                        opacity={typeof element.opacity === 'number' ? element.opacity : 1}
                      />
                      {qrPreviewCache?.[element.id]?.image ? (
                        <KonvaImage
                          image={qrPreviewCache[element.id].image}
                          x={0}
                          y={0}
                          width={element.width || 120}
                          height={element.height || 120}
                          opacity={typeof element.opacity === 'number' ? element.opacity : 1}
                          listening={false}
                        />
                      ) : (
                        <Text
                          x={0}
                          y={0}
                          width={element.width || 120}
                          height={element.height || 120}
                          text="QR"
                          fontSize={Math.max(10, Math.round(Math.min(element.width || 120, element.height || 120) / 4))}
                          fontFamily="Arial"
                          fill="#111827"
                          align="center"
                          verticalAlign="middle"
                          opacity={typeof element.opacity === 'number' ? element.opacity : 1}
                          listening={false}
                        />
                      )}
                    </Group>
                  </Group>
                ) : element.type === 'shape' ? (
                  <Group
                    x={element.x || 0}
                    y={element.y || 0}
                    rotation={element.rotation || 0}
                    ref={(node) => { if (node) shapeRefs.current[element.id] = node; }}
                    draggable={element.draggable}
                    onClick={(e) => handleSelectElement(element, e)}
                    onDragEnd={(e) => {
                      handleUpdateElement(element.id, { x: e.target.x(), y: e.target.y() });
                    }}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      const prevW = element.width || 100;
                      const prevH = element.height || 100;
                      let newW = Math.max(5, prevW * scaleX);
                      let newH = Math.max(5, prevH * scaleY);
                      if (element.shapeType === 'circle') {
                        const s = Math.max(newW, newH);
                        newW = s;
                        newH = s;
                      }
                      handleUpdateElement(element.id, {
                        x: node.x(),
                        y: node.y(),
                        width: newW,
                        height: newH,
                        rotation: node.rotation()
                      });
                      node.scaleX(1);
                      node.scaleY(1);
                    }}
                    shadowColor={element.shadowColor || 'rgba(0,0,0,0)'}
                    shadowBlur={element.shadowBlur || 0}
                    shadowOffset={{ x: element.shadowOffsetX || 0, y: element.shadowOffsetY || 0 }}
                    shadowOpacity={typeof element.shadowOpacity === 'number' ? element.shadowOpacity : 1}
                  >
                    {element.shapeType === 'circle' ? (
                      <Circle
                        x={(element.width || 100) / 2}
                        y={(element.height || 100) / 2}
                        radius={Math.max(2, Math.min(element.width || 100, element.height || 100) / 2)}
                        fill={element.fill || '#3b82f6'}
                        stroke={element.borderColor || '#111827'}
                        strokeWidth={Math.max(0, element.borderWidth || 0)}
                        opacity={typeof element.opacity === 'number' ? element.opacity : 1}
                      />
                    ) : element.shapeType === 'triangle' ? (
                      <RegularPolygon
                        x={(element.width || 100) / 2}
                        y={(element.height || 100) / 2}
                        sides={3}
                        radius={Math.max(2, Math.min(element.width || 100, element.height || 100) / 2)}
                        fill={element.fill || '#f59e0b'}
                        stroke={element.borderColor || '#111827'}
                        strokeWidth={Math.max(0, element.borderWidth || 0)}
                        opacity={typeof element.opacity === 'number' ? element.opacity : 1}
                      />
                    ) : (
                      <Rect
                        x={0}
                        y={0}
                        width={element.width || 160}
                        height={element.height || 100}
                        fill={element.fill || '#3b82f6'}
                        stroke={element.borderColor || '#111827'}
                        strokeWidth={Math.max(0, element.borderWidth || 0)}
                        cornerRadius={Math.max(0, element.borderRadius || 0)}
                        opacity={typeof element.opacity === 'number' ? element.opacity : 1}
                      />
                    )}
                  </Group>
                ) : (
                  <Group
                    x={element.x || 0}
                    y={element.y || 0}
                    rotation={element.rotation || 0}
                    ref={(node) => { if (node) shapeRefs.current[element.id] = node; }}
                    draggable={element.draggable}
                    onClick={(e) => handleSelectElement(element, e)}
                    onDragEnd={(e) => {
                      handleUpdateElement(element.id, { x: e.target.x(), y: e.target.y() });
                    }}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      const newWidth = Math.max(5, (element.width || 100) * scaleX);
                      const newHeight = Math.max(5, (element.height || 100) * scaleY);
                      handleUpdateElement(element.id, {
                        x: node.x(),
                        y: node.y(),
                        width: newWidth,
                        height: newHeight,
                        rotation: node.rotation()
                      });
                      node.scaleX(1);
                      node.scaleY(1);
                    }}
                    shadowColor={element.shadowColor || 'rgba(0,0,0,0)'}
                    shadowBlur={element.shadowBlur || 0}
                    shadowOffset={{ x: element.shadowOffsetX || 0, y: element.shadowOffsetY || 0 }}
                    shadowOpacity={typeof element.shadowOpacity === 'number' ? element.shadowOpacity : 1}
                  >
                    <Group
                      clipFunc={element.borderRadius ? (ctx) => {
                        const w = element.width || 100;
                        const h = element.height || 100;
                        const r = Math.min(element.borderRadius || 0, w / 2, h / 2);
                        const x = 0, y = 0;
                        ctx.beginPath();
                        ctx.moveTo(x + r, y);
                        ctx.arcTo(x + w, y, x + w, y + h, r);
                        ctx.arcTo(x + w, y + h, x, y + h, r);
                        ctx.arcTo(x, y + h, x, y, r);
                        ctx.arcTo(x, y, x + w, y, r);
                        ctx.closePath();
                      } : undefined}
                    >
                      <KonvaImage
                        image={imageCache[element.id] || null}
                        x={0}
                        y={0}
                        width={element.width || 100}
                        height={element.height || 100}
                        opacity={typeof element.opacity === 'number' ? element.opacity : 1}
                        listening={true}
                      />
                      {(element.borderWidth || 0) > 0 && (
                        <Rect
                          x={0}
                          y={0}
                          width={element.width || 100}
                          height={element.height || 100}
                          stroke={element.borderColor || '#000'}
                          strokeWidth={element.borderWidth || 1}
                          cornerRadius={element.borderRadius || 0}
                          listening={false}
                        />
                      )}
                    </Group>
                  </Group>
                )}
              </React.Fragment>
            ))}

            <Transformer
              ref={transformerRef}
              rotateEnabled
              keepRatio={selectedElement?.type === 'image'
                ? lockImageRatio
                : (selectedElement?.type === 'shape' && selectedElement?.shapeType === 'circle')}
              boundBoxFunc={(oldBox, newBox) => {
                const MIN_SIZE = 10;
                if (newBox.width < MIN_SIZE || newBox.height < MIN_SIZE) {
                  return oldBox;
                }
                return newBox;
              }}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']}
              shouldOverdrawWholeArea={true}
            />
          </Layer>
        </Stage>
      </Paper>
    </Box>
  );
};

export default CertificateEditorCanvas;
