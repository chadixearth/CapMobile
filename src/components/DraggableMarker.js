import React, { useState, useRef } from 'react';
import { View, PanGestureHandler, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DraggableMarker = ({ onDrag, color, icon, roadHighlights, findNearestRoadPoint }) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const [isDragging, setIsDragging] = useState(false);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: pan.x, translationY: pan.y } }],
    { useNativeDriver: false }
  );

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.state === 5) { // ENDED
      setIsDragging(false);
      
      // Convert screen coordinates to map coordinates (simplified)
      const screenX = event.nativeEvent.absoluteX;
      const screenY = event.nativeEvent.absoluteY;
      
      // This would need proper coordinate conversion based on map bounds
      // For now, trigger magnetic snap to nearest road
      if (onDrag) {
        onDrag(screenX, screenY);
      }
      
      // Reset position
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false,
      }).start();
    } else if (event.nativeEvent.state === 2) { // BEGAN
      setIsDragging(true);
    }
  };

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 50,
            right: 20,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: color,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: isDragging ? 8 : 4,
            shadowColor: '#000',
            shadowOpacity: isDragging ? 0.5 : 0.3,
            shadowRadius: isDragging ? 8 : 4,
            shadowOffset: { width: 0, height: isDragging ? 4 : 2 },
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: isDragging ? 1.2 : 1 }
            ]
          }
        ]}
      >
        <Ionicons name={icon} size={20} color="#fff" />
      </Animated.View>
    </PanGestureHandler>
  );
};

export default DraggableMarker;