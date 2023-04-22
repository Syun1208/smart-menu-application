package com.example.mobile_java;

import android.annotation.SuppressLint;
import android.app.ProgressDialog;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.Manifest;
import android.graphics.BitmapFactory;
import android.graphics.drawable.BitmapDrawable;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.fragment.app.Fragment;
import androidx.preference.PreferenceManager;

import android.os.Environment;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Message;
import android.provider.MediaStore;
import android.text.method.ScrollingMovementMethod;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.android.material.snackbar.Snackbar;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.Date;

public class MenuScannerFragment extends Fragment {

    private static final String TAG = MainActivity.class.getSimpleName();
    public static final int OPEN_GALLERY_REQUEST_CODE = 0;
    public static final int TAKE_PHOTO_REQUEST_CODE = 1;

    public static final int REQUEST_LOAD_MODEL = 0;
    public static final int REQUEST_RUN_MODEL = 1;
    public static final int RESPONSE_LOAD_MODEL_SUCCESSED = 0;
    public static final int RESPONSE_LOAD_MODEL_FAILED = 1;
    public static final int RESPONSE_RUN_MODEL_SUCCESSED = 2;
    public static final int RESPONSE_RUN_MODEL_FAILED = 3;

    protected ProgressDialog pbLoadModel = null;
    protected ProgressDialog pbRunModel = null;

    protected Handler receiver = null; // Receive messages from worker thread
    protected Handler sender = null; // Send command to worker thread
    protected HandlerThread worker = null; // Worker thread to load&run model

    // UI components of object detection
    protected TextView tvInputSetting;
    protected TextView tvStatus;
    protected ImageView ivInputImage;
    protected TextView tvOutputResult;
    protected TextView tvInferenceTime;

    // Model settings of object detection
    protected String modelPath = "";
    protected String labelPath = "";
    protected String imagePath = "";
    protected int cpuThreadNum = 1;
    protected String cpuPowerMode = "";
    protected String inputColorFormat = "";
    protected long[] inputShape = new long[]{};
    protected float[] inputMean = new float[]{};
    protected float[] inputStd = new float[]{};
    protected float scoreThreshold = 0.1f;
    private String currentPhotoPath;
    private final AssetManager assetManager = null;

    protected Predictor predictor = new Predictor();

    Button btn_load_model_click;
    Button btn_run_model_click;
    Button btn_take_photo_click;
    Button btn_choice_img_click;

    public MenuScannerFragment() {
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Clear all setting items to avoid app crashing due to the incorrect settings
        SharedPreferences sharedPreferences = PreferenceManager.getDefaultSharedPreferences(requireContext());
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.clear();
        editor.apply();

    }

    @SuppressLint("HandlerLeak")
    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        FloatingActionButton fab = (FloatingActionButton) view.findViewById(R.id.chatbot_button);
        fab.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Snackbar.make(view, "Your chatbot is updating", Snackbar.LENGTH_LONG).setAction("Action", null).show();
                Log.d("Chatbot", "You are touching chatbot");
            }
        });

        // Setup the UI components
        tvInputSetting = view.findViewById(R.id.tv_input_setting);
        tvStatus = view.findViewById(R.id.tv_model_img_status);
        ivInputImage = view.findViewById(R.id.iv_input_image);
        tvInferenceTime = view.findViewById(R.id.tv_inference_time);
        tvOutputResult = view.findViewById(R.id.tv_output_result);
        tvInputSetting.setMovementMethod(ScrollingMovementMethod.getInstance());
        tvOutputResult.setMovementMethod(ScrollingMovementMethod.getInstance());

        // Prepare the worker thread for mode loading and inference
        receiver = new Handler() {
            @SuppressLint("HandlerLeak")
            @Override
            public void handleMessage(Message msg) {
                switch (msg.what) {
                    case RESPONSE_LOAD_MODEL_SUCCESSED:
                        if (pbLoadModel != null && pbLoadModel.isShowing()) {
                            pbLoadModel.dismiss();
                        }
                        onLoadModelSuccessed();
                        break;
                    case RESPONSE_LOAD_MODEL_FAILED:
                        if (pbLoadModel != null && pbLoadModel.isShowing()) {
                            pbLoadModel.dismiss();
                        }
                        Toast.makeText(requireContext(), "Load model failed!", Toast.LENGTH_SHORT).show();
                        onLoadModelFailed();
                        break;
                    case RESPONSE_RUN_MODEL_SUCCESSED:
                        if (pbRunModel != null && pbRunModel.isShowing()) {
                            pbRunModel.dismiss();
                        }
                        onRunModelSuccessed();
                        break;
                    case RESPONSE_RUN_MODEL_FAILED:
                        if (pbRunModel != null && pbRunModel.isShowing()) {
                            pbRunModel.dismiss();
                        }
                        Toast.makeText(requireContext(), "Run model failed!", Toast.LENGTH_SHORT).show();
                        onRunModelFailed();
                        break;
                    default:
                        break;
                }
            }
        };
        worker = new HandlerThread("Predictor Worker");
        worker.start();
        sender = new Handler(worker.getLooper()) {
            public void handleMessage(Message msg) {
                switch (msg.what) {
                    case REQUEST_LOAD_MODEL:
                        // Load model and reload test image
                        if (onLoadModel()) {
                            receiver.sendEmptyMessage(RESPONSE_LOAD_MODEL_SUCCESSED);
                        } else {
                            receiver.sendEmptyMessage(RESPONSE_LOAD_MODEL_FAILED);
                        }
                        break;
                    case REQUEST_RUN_MODEL:
                        // Run model if model is loaded
                        if (onRunModel()) {
                            receiver.sendEmptyMessage(RESPONSE_RUN_MODEL_SUCCESSED);
                        } else {
                            receiver.sendEmptyMessage(RESPONSE_RUN_MODEL_FAILED);
                        }
                        break;
                    default:
                        break;
                }
            }
        };
        this.buttonLoadModel(view);
        this.buttonRunModel(view);
        this.buttonTakePicture(view);
        this.buttonOpenGallery(view);

    }

    @SuppressLint("SetTextI18n")
    public void onLoadModelSuccessed() {
        tvStatus.setText("STATUS: load model successed");
    }

    public boolean onRunModel() {
        return predictor.isLoaded() && predictor.runModel();
    }

    @SuppressLint("SetTextI18n")
    public void onLoadModelFailed() {
        tvStatus.setText("STATUS: load model failed");
    }

    @SuppressLint("SetTextI18n")
    public void onRunModelFailed() {
        tvStatus.setText("STATUS: run model failed");
    }

    @SuppressLint("SetTextI18n")
    public void onRunModelSuccessed() {
        tvStatus.setText("STATUS: run model successed");
        // Obtain results and update UI
        tvInferenceTime.setText("Inference time: " + predictor.inferenceTime() + " ms");
        Bitmap outputImage = predictor.outputImage();
        if (outputImage != null) {
            ivInputImage.setImageBitmap(outputImage);
        }
        tvOutputResult.setText(predictor.outputResult());
        tvOutputResult.scrollTo(0, 0);
    }

    @SuppressLint("SetTextI18n")
    public void buttonLoadModel(View view) {
        btn_load_model_click = view.findViewById(R.id.btn_load_model);
        btn_load_model_click.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                tvStatus.setText("STATUS: loading model ......");
                Toast.makeText(requireContext(), "CLick load model", Toast.LENGTH_SHORT).show();
                loadModel();
            }
        });
    }

    public void loadModel() {
        pbLoadModel = ProgressDialog.show(requireContext(), "", "loading model...", false, false);
        sender.sendEmptyMessage(REQUEST_LOAD_MODEL);
    }

    public boolean onLoadModel() {
        return predictor.init(MenuScannerFragment.this, modelPath, labelPath, cpuThreadNum, cpuPowerMode, inputColorFormat, inputShape, inputMean, inputStd, scoreThreshold);
    }

    @SuppressLint("SetTextI18n")
    public void buttonRunModel(View view) {
        btn_run_model_click = view.findViewById(R.id.btn_run_model);
        btn_run_model_click.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                tvStatus.setText("STATUS: run model .....");
                Toast.makeText(requireContext(), "Click run model", Toast.LENGTH_SHORT).show();
            }
        });
    }

    public void buttonTakePicture(View view) {
        btn_take_photo_click = view.findViewById(R.id.btn_take_photo);
        btn_take_photo_click.setOnClickListener(new View.OnClickListener() {
            @SuppressLint("SetTextI18n")
            @Override
            public void onClick(View view) {
                tvStatus.setText("STATUS: open camera....");
                Toast.makeText(requireContext(), "CLick open camera", Toast.LENGTH_SHORT).show();
                Log.i("REQUEST", String.valueOf(requestAllPermissions()));
                takePhoto();
            }
        });
    }

    private boolean requestAllPermissions() {
        if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(requireActivity(), new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE, Manifest.permission.CAMERA}, 0);
            return false;
        }
        return true;
    }

    private File createImageFile() throws IOException {
        // Create an image file name
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss").format(new Date());
        String imageFileName = "JPEG_" + timeStamp + "_";
        File storageDir = getActivity().getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        File image = File.createTempFile(imageFileName,  /* prefix */
                ".bmp",         /* suffix */
                storageDir      /* directory */);

        return image;
    }

    public void takePhoto() {
        Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        // Ensure that there's a camera activity to handle the intent
        if (takePictureIntent.resolveActivity(getActivity().getPackageManager()) != null) {
            // Create the File where the photo should go
            File photoFile = null;
            try {
                photoFile = createImageFile();
            } catch (IOException ex) {
                Log.e("MainActitity", ex.getMessage(), ex);
                Toast.makeText(requireContext(), "Create Camera temp file failed: " + ex.getMessage(), Toast.LENGTH_SHORT).show();
            }
            // Continue only if the File was successfully created
            if (photoFile != null) {
                Log.i(TAG, "FILEPATH " + getActivity().getExternalFilesDir("Pictures").getAbsolutePath());
                Uri photoURI = FileProvider.getUriForFile(requireContext(), "com.example.mobile_java.fileprovider", photoFile);
                currentPhotoPath = photoFile.getAbsolutePath();
                takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoURI);
                startActivityForResult(takePictureIntent, TAKE_PHOTO_REQUEST_CODE);
                Log.i(TAG, "startActivityForResult finished");
            }
        }
    }

    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == TAKE_PHOTO_REQUEST_CODE) {
            if (currentPhotoPath != null) {
                ExifInterface exif = null;
                try {
                    exif = new ExifInterface(currentPhotoPath);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                int orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_UNDEFINED);
                Log.i(TAG, "rotation " + orientation);
                Bitmap image = BitmapFactory.decodeFile(currentPhotoPath);
                image = Utils.rotateBitmap(image, orientation);
                if (image != null) {
//                            onImageChanged(image);
                    ivInputImage.setImageBitmap(image);
                }
            } else {
                Log.e(TAG, "currentPhotoPath is null");
            }
        } else if (requestCode == OPEN_GALLERY_REQUEST_CODE) {
            try {
                ContentResolver resolver = getActivity().getContentResolver();
                Uri uri = data.getData();
                Bitmap image = MediaStore.Images.Media.getBitmap(resolver, uri);
                String[] proj = {MediaStore.Images.Media.DATA};
                Cursor cursor = getActivity().managedQuery(uri, proj, null, null, null);
                cursor.moveToFirst();
                if (image != null) {
                    ivInputImage.setImageBitmap(image);
                }
            } catch (IOException e) {
                Log.e(TAG, e.toString());
            }
        }
    }

    public void buttonOpenGallery(View view) {
        btn_choice_img_click = view.findViewById(R.id.btn_choice_img);
        btn_choice_img_click.setOnClickListener(new View.OnClickListener() {
            @SuppressLint("SetTextI18n")
            @Override
            public void onClick(View view) {
                tvStatus.setText("STATUS: open gallery....");
                Toast.makeText(requireContext(), "CLick open gallery", Toast.LENGTH_SHORT).show();
                openGallery();
            }
        });
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        return inflater.inflate(R.layout.fragment_menu_scanner, container, false);
    }

    private void openGallery() {
        Intent intent = new Intent(Intent.ACTION_PICK, null);
        intent.setDataAndType(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "image/*");
        startActivityForResult(intent, OPEN_GALLERY_REQUEST_CODE);
    }

    @SuppressLint("SetTextI18n")
    @Override
    public void onResume() {
        super.onResume();
        SharedPreferences sharedPreferences = PreferenceManager.getDefaultSharedPreferences(requireContext());
        boolean settingsChanged = false;
        String model_path = sharedPreferences.getString(getString(R.string.MODEL_PATH_KEY), getString(R.string.MODEL_PATH_DEFAULT));
        String label_path = sharedPreferences.getString(getString(R.string.LABEL_PATH_KEY), getString(R.string.LABEL_PATH_DEFAULT));
        String image_path = sharedPreferences.getString(getString(R.string.IMAGE_PATH_KEY), getString(R.string.IMAGE_PATH_DEFAULT));
        settingsChanged |= !model_path.equalsIgnoreCase(modelPath);
        settingsChanged |= !label_path.equalsIgnoreCase(labelPath);
        settingsChanged |= !image_path.equalsIgnoreCase(imagePath);
        int cpu_thread_num = Integer.parseInt(sharedPreferences.getString(getString(R.string.CPU_THREAD_NUM_KEY), getString(R.string.CPU_THREAD_NUM_DEFAULT)));
        settingsChanged |= cpu_thread_num != cpuThreadNum;
        String cpu_power_mode = sharedPreferences.getString(getString(R.string.CPU_POWER_MODE_KEY), getString(R.string.CPU_POWER_MODE_DEFAULT));
        settingsChanged |= !cpu_power_mode.equalsIgnoreCase(cpuPowerMode);
        String input_color_format = sharedPreferences.getString(getString(R.string.INPUT_COLOR_FORMAT_KEY), getString(R.string.INPUT_COLOR_FORMAT_DEFAULT));
        settingsChanged |= !input_color_format.equalsIgnoreCase(inputColorFormat);
        long[] input_shape = Utils.parseLongsFromString(sharedPreferences.getString(getString(R.string.INPUT_SHAPE_KEY), getString(R.string.INPUT_SHAPE_DEFAULT)), ",");
        float[] input_mean = Utils.parseFloatsFromString(sharedPreferences.getString(getString(R.string.INPUT_MEAN_KEY), getString(R.string.INPUT_MEAN_DEFAULT)), ",");
        float[] input_std = Utils.parseFloatsFromString(sharedPreferences.getString(getString(R.string.INPUT_STD_KEY), getString(R.string.INPUT_STD_DEFAULT)), ",");
        settingsChanged |= input_shape.length != inputShape.length;
        settingsChanged |= input_mean.length != inputMean.length;
        settingsChanged |= input_std.length != inputStd.length;
        if (!settingsChanged) {
            for (int i = 0; i < input_shape.length; i++) {
                settingsChanged |= input_shape[i] != inputShape[i];
            }
            for (int i = 0; i < input_mean.length; i++) {
                settingsChanged |= input_mean[i] != inputMean[i];
            }
            for (int i = 0; i < input_std.length; i++) {
                settingsChanged |= input_std[i] != inputStd[i];
            }
        }
        float score_threshold = Float.parseFloat(sharedPreferences.getString(getString(R.string.SCORE_THRESHOLD_KEY), getString(R.string.SCORE_THRESHOLD_DEFAULT)));
        settingsChanged |= scoreThreshold != score_threshold;
        if (settingsChanged) {
            modelPath = model_path;
            labelPath = label_path;
            imagePath = image_path;
            cpuThreadNum = cpu_thread_num;
            cpuPowerMode = cpu_power_mode;
            inputColorFormat = input_color_format;
            inputShape = input_shape;
            inputMean = input_mean;
            inputStd = input_std;
            scoreThreshold = score_threshold;
            // Update UI
            tvInputSetting.setText("Model: " + modelPath.substring(modelPath.lastIndexOf("/") + 1) + "\n" + "CPU" + " Thread Num: " + Integer.toString(cpuThreadNum) + "\n" + "CPU Power Mode: " + cpuPowerMode);
            tvInputSetting.scrollTo(0, 0);
            // Reload model if configure has been changed
//            loadModel();
//            set_img();
        }
    }

}