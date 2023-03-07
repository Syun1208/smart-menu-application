import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;

import 'package:tflite/tflite.dart';
import 'package:image_picker/image_picker.dart';

void main() => runApp(App());

class Detetion {
  String AdelaiDet;
  String YOLOv5;

  Detetion(this.AdelaiDet, this.YOLOv5);
}

class Recognition {
  String EasyOCR;
  String MMOCR;
  String VietOCR;

  Recognition(this.EasyOCR, this.MMOCR, this.VietOCR);
}

class E2E {
  String PPOCR;

  E2E(this.PPOCR);
}
class App extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: MyApp(),
    );
  }

}class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  @override
  Widget build(BuildContext context) {
    // TODO: implement build
    throw UnimplementedError();
  }
}