package com.example.mobile_java;

public class ReadWriteDetails {
    public String DoB, gender, phoneNumber;
    public ReadWriteDetails(){}
    public ReadWriteDetails(String textDoB, String textGender, String textPhoneNumber){
        this.DoB = textDoB;
        this.gender = textGender;
        this.phoneNumber = textPhoneNumber;
    }
}
