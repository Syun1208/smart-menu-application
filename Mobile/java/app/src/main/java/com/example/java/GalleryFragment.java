package com.example.java;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import android.provider.MediaStore;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;

public class GalleryFragment extends Fragment {
    public static final int OPEN_GALLERY_REQUEST_CODE = 0;
    protected ImageView ivInputImage;
    private static final String TAG = GalleryFragment.class.getSimpleName();

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        this.openGallery();
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        return inflater.inflate(R.layout.fragment_gallery, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        ivInputImage = view.findViewById(R.id.iv_input_image);

    }

    private void openGallery() {
        Intent intent = new Intent(Intent.ACTION_PICK, null);
        intent.setDataAndType(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "image/*");
        startActivityForResult(intent, OPEN_GALLERY_REQUEST_CODE);
    }

    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == OPEN_GALLERY_REQUEST_CODE) {
            ContentResolver resolver = getActivity().getContentResolver();
            try {
                Uri uri = data.getData();
                Bitmap image = MediaStore.Images.Media.getBitmap(resolver, uri);
                String[] proj = {MediaStore.Images.Media.DATA};
                Cursor cursor = getActivity().managedQuery(uri, proj, null, null, null);
                cursor.moveToFirst();
                if (image != null) {
                    ivInputImage.setImageBitmap(image);
                }
            }
            catch (Exception b){
                Log.e(TAG, b.toString());
            }

        }
    }

}