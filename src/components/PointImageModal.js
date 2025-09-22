import React from 'react';
import { Modal, View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

const PointImageModal = ({ visible, onClose, point }) => {
  if (!point || !point.image_urls || point.image_urls.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{point.title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.content}>
          {point.description ? (
            <Text style={styles.description}>{point.description}</Text>
          ) : null}
          
          <Text style={styles.imageCount}>
            {point.image_urls.length} image{point.image_urls.length > 1 ? 's' : ''}
          </Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
            {point.image_urls.map((imageUrl, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.image}
                  resizeMode="cover"
                />
              </View>
            ))}
          </ScrollView>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 18,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  imageCount: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  imageScroll: {
    marginBottom: 16,
  },
  imageContainer: {
    marginRight: 12,
  },
  image: {
    width: screenWidth - 64,
    height: 200,
    borderRadius: 8,
  },
});

export default PointImageModal;