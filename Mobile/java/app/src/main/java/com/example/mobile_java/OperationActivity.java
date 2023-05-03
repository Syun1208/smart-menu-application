package com.example.mobile_java;

import android.content.DialogInterface;
import android.os.Bundle;
import android.util.Log;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;

import androidx.appcompat.app.ActionBarDrawerToggle;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.view.GravityCompat;
import androidx.drawerlayout.widget.DrawerLayout;

import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.android.material.navigation.NavigationView;
import com.google.android.material.snackbar.Snackbar;

public class OperationActivity extends AppCompatActivity implements NavigationView.OnNavigationItemSelectedListener {


    AlertDialog.Builder builder;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_operation);
        Toolbar toolbar = (Toolbar) findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);

        DrawerLayout drawer = (DrawerLayout) findViewById(R.id.drawer_layout);
        ActionBarDrawerToggle toggle = new ActionBarDrawerToggle(this, drawer, toolbar, R.string.navigation_drawer_open, R.string.navigation_drawer_close);
        //drawer.setDrawerListener(toggle);
        drawer.addDrawerListener(toggle);
        toggle.syncState();

        NavigationView navigationView = (NavigationView) findViewById(R.id.nav_view);
        navigationView.setNavigationItemSelectedListener(this);

        if (savedInstanceState == null) {
            getSupportFragmentManager().beginTransaction().replace(R.id.fragment_container, new HomeFragment()).commit();
            navigationView.setCheckedItem(R.id.nav_home);
        }
    }

    @Override
    public void onBackPressed() {
        DrawerLayout drawer = (DrawerLayout) findViewById(R.id.drawer_layout);
        if (drawer.isDrawerOpen(GravityCompat.START)) {
            drawer.closeDrawer(GravityCompat.START);
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // Inflate the menu; this adds items to the action bar if it is present.
        getMenuInflater().inflate(R.menu.main, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Handle action bar item clicks here. The action bar will
        // automatically handle clicks on the Home/Up button, so long
        // as you specify a parent activity in AndroidManifest.xml.
        int id = item.getItemId();

        //noinspection SimplifiableIfStatement
        if (id == R.id.action_settings) {
            return true;
        }

        return super.onOptionsItemSelected(item);
    }

    @Override
    public boolean onNavigationItemSelected(MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.nav_home) {
            getSupportFragmentManager().beginTransaction().replace(R.id.fragment_container, new HomeFragment()).commit();
        } else if (id == R.id.nav_user_information) {
            getSupportFragmentManager().beginTransaction().replace(R.id.fragment_container, new UserFragment()).commit();
        } else if (id == R.id.nav_menu_scanner) {
            getSupportFragmentManager().beginTransaction().replace(R.id.fragment_container, new MenuScannerFragment()).commit();
        } else if (id == R.id.nav_translator) {
            getSupportFragmentManager().beginTransaction().replace(R.id.fragment_container, new EnglishTranslatorFragment()).commit();

        } else if (id == R.id.nav_recommender) {
            getSupportFragmentManager().beginTransaction().replace(R.id.fragment_container, new FoodRecommenderFragment()).commit();

        } else if (id == R.id.nav_gallery) {
            getSupportFragmentManager().beginTransaction().replace(R.id.fragment_container, new GalleryFragment()).commit();

        } else if (id == R.id.nav_share) {
            getSupportFragmentManager().beginTransaction().replace(R.id.fragment_container, new ShareFragment()).commit();

        } else if (id == R.id.nav_help) {
            getSupportFragmentManager().beginTransaction().replace(R.id.fragment_container, new HelpFragment()).commit();

        } else if (id == R.id.nav_about_us) {
            getSupportFragmentManager().beginTransaction().replace(R.id.fragment_container, new AboutUsFragment()).commit();
        } else if (id == R.id.nav_exit) {
            this.showExitDialog();
        }
        DrawerLayout drawer = (DrawerLayout) findViewById(R.id.drawer_layout);
        drawer.closeDrawer(GravityCompat.START);
        return true;
    }

    private void showExitDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Exit");
        builder.setMessage("Are you sure you want to exit?");
        builder.setPositiveButton("Yes", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                // exit the app
                finish();
            }
        });
        builder.setNegativeButton("No", null);
        builder.show();
    }

}