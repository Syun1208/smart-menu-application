package com.example.mobile_java;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.ProgressDialog;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.android.material.snackbar.Snackbar;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;

public class EnglishTranslatorFragment extends Fragment {
    HashMap<String, String> dictionary;

    public EnglishTranslatorFragment() {
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            HashMap<String, String> dictionary = this.loadVocabFile("labels/dict_translate.json");
            Log.i("INFO", "LOAD DICTIONARY SUCCESSFULLY");
            String inputTest = "CÁ DÌA HẤP XÌ DẦU";
            Log.i("INFO" , String.valueOf(dictionary.get(inputTest.toUpperCase())));
            Log.i("LENGTH", String.valueOf(dictionary.size()));
        } catch (IOException | JSONException e) {
            throw new RuntimeException(e);
        }

    }
    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        return inflater.inflate(R.layout.fragment_english_translator, container, false);
    }

    public HashMap<String, String> loadVocabFile(String fileName) throws IOException, JSONException {
        AssetManager assetManager = getActivity().getAssets();
        InputStream inputStream = assetManager.open(fileName);
        BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream));
        StringBuilder stringBuilder = new StringBuilder();
        String line = null;
        while ((line = reader.readLine()) != null) {
            stringBuilder.append(line);
        }
        String jsonString = stringBuilder.toString();
        JSONObject vocabJson = new JSONObject(jsonString);
        HashMap<String, String> vocabMap = new HashMap<>();
        Iterator<String> keys = vocabJson.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            String value = vocabJson.getString(key);
            vocabMap.put(key, value);
        }
        return vocabMap;
    }

}