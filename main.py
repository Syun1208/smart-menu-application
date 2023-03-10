from kivy.app import App
from kivy.uix.camera import Camera
from kivy.uix.button import Button
from kivy.uix.image import Image
from kivy.uix.boxlayout import BoxLayout
import numpy as np
import cv2


class MyApp(App):
    def __init__(self, **kwargs):
        super(MyApp, self).__init__()
        self.image = None
        self.camera = None

    def build(self):
        # Create a camera widget
        self.camera = Camera(
            resolution=(640, 480),  # Set the resolution of the camera
            play=False  # Don't start the camera playing yet
        )

        # Create an image widget
        self.image = Image()

        # Create a button widget
        button = Button(text='Capture', size_hint=(0.1, 0.1))
        button.bind(on_press=self.capture_image)

        # Add the camera, image, and button widgets to a layout
        layout = BoxLayout(orientation='vertical')
        layout.add_widget(self.camera)
        layout.add_widget(self.image)
        self.convert_kivy_image_to_opencv(self.image)
        print(self.image)
        layout.add_widget(button)

        return layout

    def capture_image(self, instance):
        # Set the camera to play mode
        self.camera.play = True

        # Take a picture and store it in a file named 'capture.png'
        self.camera.export_to_png('capture.png')

        # Set the texture of the image widget to the captured image
        self.image.source = 'capture.png'

        # Stop the camera
        self.camera.play = False

    @staticmethod
    def convert_kivy_image_to_opencv(kivy_image):
        # Get the texture of the image widget
        texture = kivy_image.texture

        # Convert the texture to an array of pixel values
        pixels = texture.pixels

        # Get the size of the texture
        width = texture.size[0]
        height = texture.size[1]

        # Reshape the pixel array to match the texture size
        buf = pixels[:height * width * 4]
        image_array = np.frombuffer(buf, dtype=np.uint8)
        image_array = image_array.reshape((height, width, 4))

        # Convert the pixel array to an OpenCV image
        cv_image = cv2.cvtColor(image_array, cv2.COLOR_RGBA2BGR)

        return cv_image


if __name__ == '__main__':
    MyApp().run()
