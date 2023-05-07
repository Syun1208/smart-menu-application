package com.example.mobile_java;

import android.annotation.SuppressLint;
import android.content.DialogInterface;
import android.content.Intent;
import android.media.Image;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.android.material.snackbar.Snackbar;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.squareup.picasso.Picasso;

import java.net.InetSocketAddress;

public class UserFragment extends Fragment {

    private TextView textViewWelcome, textViewUserName, textViewEmail, textViewDob, textViewGender, textViewPhoneNumber;
    private ProgressBar progressBar;
    private String userName, email, dob, gender, phoneNumber;
    private ImageView imageView;
    private FirebaseAuth firebaseAuth;
    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setHasOptionsMenu(true);


    }

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

        textViewWelcome = view.findViewById(R.id.tv_show_welcome);
        textViewUserName = view.findViewById(R.id.tv_show_user_name);
        textViewEmail = view.findViewById(R.id.tv_show_email);
        textViewDob = view.findViewById(R.id.tv_show_dob);
        textViewGender = view.findViewById(R.id.tv_show_gender);
        textViewPhoneNumber = view.findViewById(R.id.tv_show_phone_number);
        progressBar = view.findViewById(R.id.progress_bar);

        imageView = view.findViewById(R.id.iv_user_avatar);
        imageView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent intent = new Intent(getActivity(), UpdateAvatarActivity.class);
                startActivity(intent);
            }
        });

        firebaseAuth = FirebaseAuth.getInstance();
        FirebaseUser firebaseUser = firebaseAuth.getCurrentUser();

        if (firebaseUser == null){
            Toast.makeText(requireContext(), "User's details are not available", Toast.LENGTH_SHORT).show();
        } else {
            checkIfEmailVerified(firebaseUser);
            progressBar.setVisibility(View.VISIBLE);
            showUserProfile(firebaseUser);
        }
    }

    private void checkIfEmailVerified(FirebaseUser firebaseUser) {
        if (!firebaseUser.isEmailVerified()){
            showAlertDialog();
        }
    }

    private void showAlertDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(requireContext());
        builder.setTitle("Email is not verified");
        builder.setMessage("Please verify your email now. You cannot login without email verification next time");

        builder.setPositiveButton("Continue", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialogInterface, int i) {
                Intent intent = new Intent(Intent.ACTION_MAIN);
                intent.addCategory(Intent.CATEGORY_APP_EMAIL);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            }
        });

        AlertDialog alertDialog = builder.create();
        alertDialog.show();
    }

    private void showUserProfile(FirebaseUser firebaseUser) {
        String userID = firebaseUser.getUid();
        // Extracting user reference from database for "registered users"
        DatabaseReference databaseReference = FirebaseDatabase.getInstance().getReference("Registered users");
        databaseReference.child(userID).addListenerForSingleValueEvent(new ValueEventListener() {
            @SuppressLint("SetTextI18n")
            @Override
            public void onDataChange(@NonNull DataSnapshot snapshot) {
                ReadWriteDetails readWriteDetails = snapshot.getValue(ReadWriteDetails.class);
                if (readWriteDetails != null){
                    userName = firebaseUser.getDisplayName();
                    email = firebaseUser.getEmail();
                    dob = readWriteDetails.DoB;
                    gender = readWriteDetails.gender;
                    phoneNumber = readWriteDetails.phoneNumber;

                    // Set information to profile from firebase
                    textViewWelcome.setText("Welcome, " + userName + "!");
                    textViewUserName.setText(userName);
                    textViewEmail.setText(email);
                    textViewDob.setText(dob);
                    textViewGender.setText(gender);
                    textViewPhoneNumber.setText(phoneNumber);

                    // Set image to avatar from firebase
                    Uri uri = firebaseUser.getPhotoUrl();
                    Picasso.with(getActivity()).load(uri).into(imageView);
                } else {
                    Toast.makeText(requireContext(), "Something went wrong!", Toast.LENGTH_SHORT).show();
                }
                progressBar.setVisibility(View.GONE);
            }

            @Override
            public void onCancelled(@NonNull DatabaseError error) {
                Toast.makeText(requireContext(), "Something went wrong !", Toast.LENGTH_SHORT).show();
                progressBar.setVisibility(View.GONE);
            }
        });
    }


    @Override
    public void onCreateOptionsMenu(@NonNull Menu menu, @NonNull MenuInflater inflater) {
        super.onCreateOptionsMenu(menu, inflater);
        getActivity().getMenuInflater().inflate(R.menu.common_menu,menu);
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        int id  = item.getItemId();

        if (id == R.id.menu_refresh){
            startActivity(requireActivity().getIntent());
            getActivity().finish();
            getActivity().overridePendingTransition(0,0);
        } else if (id == R.id.menu_update_profile){
            Intent intent = new Intent(requireActivity(), UpdateProfileActivity.class);
            startActivity(intent);
            getActivity().finish();
        } /*else if (id == R.id.menu_update_email){
            Intent intent = new Intent(requireActivity(), UpdateEmailActivity.class);
            startActivity(intent);
        } else if (id == R.id.menu_settings){
            Toast.makeText(requireContext(), "menu settings", Toast.LENGTH_SHORT).show();
        } else if (id == R.id.menu_change_password){
            Intent intent = new Intent(requireActivity(), ChangePasswordActivity.class);
            startActivity(intent);
        } else if (id == R.id.menu_delete_profile){
            Intent intent = new Intent(requireActivity(), DeleteProfileActivity.class);
            startActivity(intent);
        } else if (id == R.id.menu_logout){
            firebaseAuth.signOut();
            Toast.makeText(requireContext(), "Logged out", Toast.LENGTH_SHORT).show();
            Intent intent = new Intent(requireActivity(), MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_CLEAR_TASK | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            getActivity().finish();
        } */else {
            Toast.makeText(requireContext(), "Something went wrong", Toast.LENGTH_SHORT).show();
        }
        return super.onOptionsItemSelected(item);
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater,
                             @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_user, container, false);
    }
}