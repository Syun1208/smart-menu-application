package com.example.java;

import android.content.res.AssetManager;
import android.os.Bundle;

import androidx.fragment.app.Fragment;

import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
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