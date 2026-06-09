const plantumlEncoder = require('plantuml-encoder');
const https = require('https');
const fs = require('fs');

const uml = `@startuml
left to right direction
skinparam packageStyle rectangle
skinparam usecase { BackgroundColor White BorderColor Black }
actor "Guest" as Guest
actor "User (logged in)" as User
actor "Admin" as Admin
User --|> Guest
Admin --|> User
rectangle "Jewish On The Way - System Boundary" {
  rectangle "Public - No Login Required" {
    usecase "Browse Destinations" as UC1
    usecase "View Restaurants" as UC2
    usecase "View Synagogues" as UC3
    usecase "AI Smart Search" as UC4
    usecase "View Shabbat Times" as UC5
    usecase "View Qibla Compass" as UC6
    usecase "View Interactive Map" as UC7
    usecase "Find Places Near Me" as UC8
    usecase "Register" as UC9
    usecase "Login" as UC10
    usecase "Reset Password" as UC11
  }
  rectangle "User Actions" {
    usecase "Save / Unsave Favorite" as UC12
    usecase "Rate and Review Place" as UC13
    usecase "Report a Place" as UC14
    usecase "Request a New Place" as UC15
    usecase "Edit Profile and Kashrut Level" as UC16
    usecase "Upload Delete Avatar" as UC17
    usecase "Change Password" as UC18
    usecase "Delete Account" as UC19
  }
  rectangle "Community" {
    usecase "Send Destination Chat Message" as UC20
  }
  rectangle "Minyans" {
    usecase "Create Minyan" as UC21
    usecase "Join Minyan" as UC22
    usecase "Leave Minyan" as UC23
    usecase "Delete Own Minyan" as UC24
    usecase "View My Minyans" as UC25
  }
  rectangle "Hosting" {
    usecase "Search Hosting Offers" as UC26
    usecase "Post Hosting Offer" as UC27
    usecase "Deactivate Own Offer" as UC28
    usecase "Request Hosting" as UC29
    usecase "Approve Hosting Request" as UC30
    usecase "Reject Hosting Request" as UC31
    usecase "Chat in Hosting Request" as UC32
  }
  rectangle "Admin Panel" {
    usecase "Create Destination" as UC33
    usecase "Delete Destination" as UC34
    usecase "Create Restaurant" as UC35
    usecase "Delete Restaurant" as UC36
    usecase "Bulk Import Synagogues" as UC37
    usecase "Approve Candidate Synagogue" as UC38
    usecase "Reject Candidate Synagogue" as UC39
    usecase "Delete Synagogue" as UC40
    usecase "Block User" as UC41
    usecase "Delete Chat Message" as UC42
    usecase "Resolve Place Reports" as UC43
    usecase "Resolve Place Requests" as UC44
  }
}
Guest --> UC1
Guest --> UC2
Guest --> UC3
Guest --> UC4
Guest --> UC5
Guest --> UC6
Guest --> UC7
Guest --> UC8
Guest --> UC9
Guest --> UC10
Guest --> UC11
User --> UC12
User --> UC13
User --> UC14
User --> UC15
User --> UC16
User --> UC17
User --> UC18
User --> UC19
User --> UC20
User --> UC21
User --> UC22
User --> UC23
User --> UC24
User --> UC25
User --> UC26
User --> UC27
User --> UC28
User --> UC29
User --> UC30
User --> UC31
User --> UC32
Admin --> UC33
Admin --> UC34
Admin --> UC35
Admin --> UC36
Admin --> UC37
Admin --> UC38
Admin --> UC39
Admin --> UC40
Admin --> UC41
Admin --> UC42
Admin --> UC43
Admin --> UC44
@enduml`;

const encoded = plantumlEncoder.encode(uml);
const url = `https://www.plantuml.com/plantuml/png/${encoded}`;

console.log('Downloading...');
const file = fs.createWriteStream('docs/use-case-updated.png');
https.get(url, res => {
  if (res.statusCode !== 200) { console.error('HTTP', res.statusCode); process.exit(1); }
  res.pipe(file);
  file.on('finish', () => {
    const size = fs.statSync('docs/use-case-updated.png').size;
    console.log(`Done: docs/use-case-updated.png (${(size/1024).toFixed(1)} KB)`);
  });
}).on('error', err => console.error(err.message));
