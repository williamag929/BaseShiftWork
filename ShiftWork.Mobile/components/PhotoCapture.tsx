import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCaptured: (uri: string) => void;
}

export default function PhotoCapture({ visible, onClose, onCaptured }: Props) {
  const cameraRef = useRef<Camera | null>(null);
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible]);

  const takePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;
    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true });
      setPreviewUri(photo.uri);
    } catch (e) {
      // noop
    } finally {
      setIsCapturing(false);
    }
  };

  const confirm = () => {
    if (previewUri) {
      onCaptured(previewUri);
      onClose();
      setPreviewUri(null);
    }
  };

  const retake = () => setPreviewUri(null);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!permission || !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.text}>Camera permission is required</Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        ) : previewUri ? (
          <View style={styles.previewContainer}>
            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
            {/* @ts-ignore ImageBackground not needed; we can use expo-image later */}
            <Camera style={styles.preview} type={CameraType.back}>
              {/* Using camera only for consistent view; we could show Image with source={{uri: previewUri}} */}
            </Camera>
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={retake}>
                <Ionicons name="refresh" size={24} color="#fff" />
                <Text style={styles.actionText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={confirm}>
                <Ionicons name="checkmark" size={24} color="#fff" />
                <Text style={styles.actionText}>Use Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
            <Camera
              ref={(r) => (cameraRef.current = r)}
              style={styles.camera}
              type={CameraType.front}
              onCameraReady={() => setIsReady(true)}
            />
            <View style={styles.captureBar}>
              <TouchableOpacity style={styles.captureBtn} onPress={takePhoto} disabled={!isReady || isCapturing}>
                {isCapturing ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera" size={32} color="#fff" />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  text: { color: '#fff', fontSize: 16, marginBottom: 16 },
  permBtn: { backgroundColor: '#4A90E2', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  permText: { color: '#fff', fontWeight: '600' },
  cameraWrapper: { flex: 1 },
  camera: { flex: 1 },
  captureBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#4A90E2', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { position: 'absolute', right: 24, top: -4, padding: 12 },
  previewContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  preview: { width: '100%', height: '80%', backgroundColor: '#000' },
  previewActions: { position: 'absolute', bottom: 40, flexDirection: 'row', gap: 16 },
  actionBtn: { backgroundColor: '#4A90E2', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionText: { color: '#fff', fontWeight: '600' },
});
