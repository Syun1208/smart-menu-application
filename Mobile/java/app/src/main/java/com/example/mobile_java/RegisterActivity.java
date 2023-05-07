package com.example.mobile_java;

import android.annotation.SuppressLint;
import android.app.DatePickerDialog;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.IntentSender;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.content.res.Configuration;
import android.content.res.Resources;
import android.database.DatabaseErrorHandler;
import android.database.sqlite.SQLiteDatabase;
import android.graphics.Bitmap;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.UserHandle;
import android.text.TextUtils;
import android.util.Log;
import android.util.Patterns;
import android.view.Display;
import android.view.View;
import android.widget.Button;
import android.widget.DatePicker;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.AuthResult;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException;
import com.google.firebase.auth.FirebaseAuthUserCollisionException;
import com.google.firebase.auth.FirebaseAuthWeakPasswordException;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.UserProfileChangeRequest;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Calendar;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class RegisterActivity extends AppCompatActivity {

    private EditText editTextRegisterFullName;
    Integer numPwd = 8;
    private EditText editTextRegisterEmail;
    private EditText editTextRegisterDoB;
    private EditText editTextRegisterPwd;
    private EditText editTextRegisterCfPwd;
    private EditText editTextRegisterPhone;

    private ProgressBar progressBar;
    private RadioGroup radioGroupRegisterGender;
    private RadioButton radioGroupRegisterGenderSelected;
    private DatePickerDialog datePickerDialog;
    private static final String TAG = "RegisterActivity";
    @SuppressLint("MissingInflatedId")
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        //getSupportActionBar().setTitle("Register");

        Toast.makeText(getApplicationContext(), "You can register now", Toast.LENGTH_LONG).show();
        editTextRegisterFullName = findViewById(R.id.et_register_full_name);
        editTextRegisterEmail = findViewById(R.id.et_register_email);
        editTextRegisterDoB = findViewById(R.id.et_register_dob);
        editTextRegisterPhone = findViewById(R.id.et_register_phone);
        editTextRegisterPwd = findViewById(R.id.et_register_pw);
        editTextRegisterCfPwd = findViewById(R.id.et_register_cf_pw);

        // radio button for gender selection
        radioGroupRegisterGender = findViewById(R.id.radio_register_gender);
        radioGroupRegisterGender.clearCheck();

        //Setting date picker on edit text
        editTextRegisterDoB.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                final Calendar calendar = Calendar.getInstance();
                int day = calendar.get(Calendar.DAY_OF_MONTH);
                int month = calendar.get(Calendar.MONTH);
                int year = calendar.get(Calendar.YEAR);

                // Date picker
                datePickerDialog = new DatePickerDialog(RegisterActivity.this, new DatePickerDialog.OnDateSetListener() {
                    @SuppressLint("SetTextI18n")
                    @Override
                    public void onDateSet(DatePicker datePicker, int year, int month, int dayOfMonth) {
                        editTextRegisterDoB.setText(dayOfMonth + "/" + (month + 1) + "/" + year);
                    }
                }, year, month, day);
                datePickerDialog.show();
            }
        });

        Button buttonRegister = findViewById(R.id.btn_register);
        buttonRegister.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                String textFullName = editTextRegisterFullName.getText().toString();
                String textEmail = editTextRegisterEmail.getText().toString();
                String textDoB = editTextRegisterDoB.getText().toString();
                String textPhoneNumber = editTextRegisterPhone.getText().toString();
                String textPwd = editTextRegisterPwd.getText().toString();
                String textCfPwd = editTextRegisterCfPwd.getText().toString();
                String textGender;
                int selectedGenderId = radioGroupRegisterGender.getCheckedRadioButtonId();
                radioGroupRegisterGenderSelected = findViewById(selectedGenderId);
                progressBar = findViewById(R.id.progress_bar);

                String mobileRegex = "[6-9][0-9]{9}";
                Matcher mobileMatcher;
                Pattern mobilePattern = Pattern.compile(mobileRegex);
                mobileMatcher = mobilePattern.matcher(textPhoneNumber);


                if (TextUtils.isEmpty(textFullName)){
                    editTextRegisterFullName.setError("Full name is required");
                    editTextRegisterFullName.requestFocus();
                } else if (TextUtils.isEmpty(textEmail)) {
                    editTextRegisterEmail.setError("Email is required");
                    editTextRegisterEmail.requestFocus();
                } else if (!Patterns.EMAIL_ADDRESS.matcher(textEmail).matches()) {
                    editTextRegisterEmail.setError("Valid email is required");
                    editTextRegisterEmail.requestFocus();
                } else if (TextUtils.isEmpty(textDoB)) {
                    editTextRegisterDoB.setError("Date of Birth is required");
                    editTextRegisterDoB.requestFocus();
                } else if (radioGroupRegisterGender.getCheckedRadioButtonId() == -1) {
                    radioGroupRegisterGenderSelected.setError("Gender is required");
                    radioGroupRegisterGenderSelected.requestFocus();
                } else if(textPhoneNumber.length() < 10 || textPhoneNumber.length() > 11) {
                    editTextRegisterPhone.setError("Phone number must be 10-11 digits");
                    editTextRegisterPhone.requestFocus();
                } else if (!mobileMatcher.find()){
                    editTextRegisterPhone.setError("Phone number is not valid");
                    editTextRegisterPhone.requestFocus();
                } else if (TextUtils.isEmpty(textPwd)) {
                    editTextRegisterPwd.setError("Password is required");
                    editTextRegisterPwd.requestFocus();
                } else if (textPwd.length() < numPwd) {
                    editTextRegisterPwd.setError("Password should be at least " + numPwd.toString() + " digits");
                    editTextRegisterPwd.requestFocus();
                } else if (TextUtils.isEmpty(textCfPwd)) {
                    editTextRegisterCfPwd.setError("Password verification is required");
                    editTextRegisterCfPwd.requestFocus();
                } else if (!textPwd.equals(textCfPwd)) {
                    editTextRegisterCfPwd.setError("Password verification is required");
                    editTextRegisterCfPwd.requestFocus();
                    // CLear the entered password
                    editTextRegisterPwd.clearComposingText();
                    editTextRegisterCfPwd.clearComposingText();
                } else {
                    textGender = radioGroupRegisterGenderSelected.getText().toString();
                    progressBar.setVisibility(View.VISIBLE);
                    registerUser(textFullName, textEmail, textDoB, textGender, textPhoneNumber, textPwd);
                }
            }
        });

    }

    private void registerUser(String textFullName, String textEmail, String textDoB, String textGender, String textPhoneNumber, String textPwd) {
        FirebaseAuth auth = FirebaseAuth.getInstance();
        auth.createUserWithEmailAndPassword(textEmail, textPwd).addOnCompleteListener(RegisterActivity.this,
                new OnCompleteListener<AuthResult>() {
                    @Override
                    public void onComplete(@NonNull Task<AuthResult> task) {
                        if (task.isSuccessful()){
                            FirebaseUser firebaseUser = auth.getCurrentUser();

                            //Update display name of user
                            UserProfileChangeRequest profileChangeRequest = new UserProfileChangeRequest.Builder().setDisplayName(textFullName).build();
                            firebaseUser.updateProfile(profileChangeRequest);

                            //Enter user data into the firebase realtime database
                            ReadWriteDetails writeUserDetails = new ReadWriteDetails(textDoB, textGender, textPhoneNumber);

                            //Extracting user reference from database for "register users"
                            DatabaseReference referenceProfile = FirebaseDatabase.getInstance().getReference("Registered users");

                            referenceProfile.child(firebaseUser.getUid()).setValue(writeUserDetails).addOnCompleteListener(new OnCompleteListener<Void>() {
                                @Override
                                public void onComplete(@NonNull Task<Void> task) {

                                    if(task.isSuccessful()){
                                        // Send verification email
                                        firebaseUser.sendEmailVerification();
                                        Toast.makeText(getApplicationContext(), "User registered successfully", Toast.LENGTH_LONG).show();

                                        //Open User Profile after successful registration
                                        Intent intent = new Intent(RegisterActivity.this, MainActivity.class);
                                        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_CLEAR_TASK | Intent.FLAG_ACTIVITY_NEW_TASK);
                                        startActivity(intent);
                                        finish();
                                    }
                                    else {
                                        Toast.makeText(getApplicationContext(), "User registered failed. Please try again", Toast.LENGTH_LONG).show();
                                        progressBar.setVisibility(View.VISIBLE);
                                    }
                                    progressBar.setVisibility(View.GONE);
                                }
                            });
                        }
                        else {
                            try {
                                throw task.getException();
                            }catch (FirebaseAuthWeakPasswordException e){
                                editTextRegisterPwd.setError("Your password is too weak. Kindly use a mix of alphabets, numbers and special characters");
                                editTextRegisterPwd.requestFocus();
                            } catch(FirebaseAuthInvalidCredentialsException e){
                                editTextRegisterEmail.setError("Your email is invalid or already in use. Kindly re-enter");
                                editTextRegisterEmail.requestFocus();
                            } catch (FirebaseAuthUserCollisionException e){
                                editTextRegisterEmail.setError("User is already registered with this email. Use another email");
                                editTextRegisterEmail.requestFocus();
                            } catch(Exception e){
                                Log.e(TAG, e.getMessage());
                                Toast.makeText(RegisterActivity.this, e.getMessage(), Toast.LENGTH_LONG).show();
                                progressBar.setVisibility(View.VISIBLE);
                            }
                            progressBar.setVisibility(View.GONE);
                        }
                    }
                }
        );

    }
}
