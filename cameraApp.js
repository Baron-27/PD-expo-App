import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  View,
  SafeAreaView,
  Button,
  Image,
  Alert,
  Modal,
  Text,
  ActivityIndicator,
  Scrollview
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Camera, CameraView } from 'expo-camera';
import { shareAsync } from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export default function App() {
  const cameraRef = useRef();
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState(false);
  const [photo, setPhoto] = useState(null); // For photo taken by the camera
  const [pickedImage, setPickedImage] = useState(null); // For image picked from gallery
  const [isDetecting, setIsDetecting] = useState(false); // Track detection process
  const [processedImage, setProcessedImage] = useState(null); // For displaying processed image
  const [isProcessingComplete, setIsProcessingComplete] = useState(false); // Flag for processing completion
  const [latestImage, setLatestImage] = useState(null); // State for storing the latest image URL

  useEffect(() => {
    (async () => {
      fetchLatestImage(); // Fetch the most recent image when the component loads
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      const mediaLibraryPermission = await MediaLibrary.requestPermissionsAsync();
      setHasCameraPermission(cameraPermission.status === 'granted');
      setHasMediaLibraryPermission(mediaLibraryPermission.status === 'granted');
    })();
  }, []);

  const takePic = async () => {
    if (cameraRef.current) {
      const options = { quality: 1, base64: true, exif: false };
      const newPhoto = await cameraRef.current.takePictureAsync(options);
      setPhoto({ uri: newPhoto.uri });
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setPickedImage(result.assets[0].uri); // Set the URI for the picked image
    } else {
      Alert.alert('No image selected!');
    }
  };

  const savePhoto = async () => {
    const uri = photo?.uri || pickedImage || processedImage ;
    if (uri) {
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved to library!');
      setPhoto(null);
      setPickedImage(null);
      setProcessedImage(null); // Reset processed image after saving
    }
  };

  const shareImage = async () => {
    const uri = photo?.uri || pickedImage || processedImage;
    if (uri) {
      await shareAsync(uri);
      setPickedImage(null);
      setProcessedImage(null); // Reset processed image after sharing
    }
  };

  const processImage = async () => {
    const uri = photo?.uri || pickedImage;
    if (!uri) {
      Alert.alert("No image to process!");
      return;
    }

    setIsDetecting(true);

    const apiUrl = "http://192.168.1.238:8000/uploadfile/"; // url of the uploaded image

    try {
      const formData = new FormData();
      formData.append("file_upload", {
        uri: uri,
        name: "image.jpg",
        type: "image/jpeg",
      });

      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
          "Content-Type": "multipart/form-data",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      if (result.image_url) {
        setProcessedImage(result.image_url); // Set the URL for the processed image
        setIsProcessingComplete(true);
      } else {
        Alert.alert("Error", "Failed to upload and process the image.");
      }
    } catch (error) {
      console.error("Error processing image:", error.message);
      Alert.alert("Error", "Failed to process the image.");
    } finally {
      setIsDetecting(false);
    }
  };

  const goBack = () => {
    setProcessedImage(null); // Clear processed image and return to previous state
    setIsProcessingComplete(false);
  }; 

  const fetchLatestImage = async () => {
    setIsLoading(true); // Show a loading indicator while fetching
    try {
      const response = await fetch("http://192.168.1.238:8000:8000/outputfile/");
      const result = await response.json();
  
      if (response.ok && result.file) {
        setLatestImage(result.file); // Update state with the fetched image URL
      } else {
        Alert.alert("Error", "No latest image found.");
      }
    } catch (error) {
      console.error("Error fetching latest image:", error.message);
      Alert.alert("Error", "Failed to fetch the latest image.");
    } finally {
      setIsLoading(false); // Hide loading indicator
    }
  };
   
  if (isDetecting) {
    return (
      <Modal transparent={true} animationType="fade">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ff00" />
          <Text style={styles.loadingText}>Processing image, please wait...</Text>
        </View>
      </Modal>
    );
  }

  if (photo || pickedImage) {
    const imageUri = photo ? photo.uri : pickedImage;

    return (
      <SafeAreaView style={styles.container}>
        <Image style={styles.preview} source={{ uri: imageUri }} />
        <View style={styles.renderprevBttnContainer}>
          <Button title="Share" onPress={shareImage} />
          {hasMediaLibraryPermission && <Button title="Save" onPress={savePhoto} />}
          <Button title="Process" onPress={processImage} />
          <Button title="Discard" onPress={() => (photo ? setPhoto(null) : setPickedImage(null))} />
        </View>
      </SafeAreaView>

      
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} />
      <View style={styles.buttonContainer}>
        <Button title="Pick an Image" onPress={pickImage} />
        <Button title="Take Pic" onPress={takePic} />
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
    
    


  );
  
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    marginBottom: 0,
  },
  renderprevBttnContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  preview: {
    width: '100%',
    height: '80%',
    resizeMode: 'contain',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: 'white',
  },
});
