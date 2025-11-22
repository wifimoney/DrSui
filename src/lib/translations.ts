export type Language = "EN" | "FR";

export const translations: Record<Language, Record<string, string>> = {
  EN: {
    // Navigation
    "nav.patient": "Patient",
    "nav.doctor": "Doctor Portal",
    "nav.zkLogin": "zkLogin",

    // Patient View
    "patient.title": "Patient Records",
    "patient.subtitle": "Manage your encrypted medical history on the Sui Network",
    "patient.upload": "Upload Record",
    "patient.totalRecords": "Total Records",
    "patient.storageUsed": "Storage Used",
    "patient.activeShares": "Active Shares",
    "patient.recordsListTitle": "Your X-Ray Records",
    "patient.wallet": "Wallet",
    "footer.poweredBy": "Powered by",

    // Doctor Portal
    "doctor.profile.specialty": "Senior Radiologist",
    "doctor.profile.id": "ID",
    "doctor.profile.hospital": "Hospital",
    "doctor.nav.inbox": "Inbox",
    "doctor.nav.patients": "My Patients",
    "doctor.nav.settings": "Settings",
    "doctor.incoming.title": "Incoming Requests",
    "doctor.incoming.pending": "pending",
    "doctor.incoming.accept": "Accept Key",
    "doctor.action.decrypt": "Decrypt",
    "doctor.action.decrypting": "Decrypting...",
    "doctor.status.encrypted": "Encrypted Record",
    "doctor.viewer.encryptedMessage": "This record is encrypted. Please decrypt to view imaging and patient details.",
    "doctor.viewer.placeholder": "X-Ray Image Viewer",
    "doctor.metadata.title": "Metadata",
    "doctor.metadata.name": "Patient Name",
    "doctor.metadata.age": "Age",
    "doctor.metadata.studyDate": "Study Date",
    "doctor.metadata.modality": "Modality",
    "doctor.metadata.bodyPart": "Body Part",
    "doctor.metadata.institution": "Institution",

    // Upload Modal
    "upload.title": "Upload Diagnostic Imaging",
    "upload.subtitle": "Securely store on Walrus",
    "upload.dragDrop": "Drag DICOM files here",
    "upload.description": "Files are encrypted and stored on Walrus. You receive the ownership NFT.",
    "upload.dateScan": "Date of Scan",
    "upload.bodyPart": "Body Part",
    "upload.selectPlaceholder": "Select body part",
    "upload.submit": "Encrypt & Mint Record",
    
    // Body Parts
    "body.chest": "Chest",
    "body.head": "Head",
    "body.abdomen": "Abdomen",
    "body.knee": "Knee",
    "body.hand": "Hand",
    "body.foot": "Foot",
    "body.spine": "Spine",
  },
  FR: {
    // Navigation
    "nav.patient": "Patient",
    "nav.doctor": "Portail Médecin",
    "nav.zkLogin": "zkLogin",

    // Patient View
    "patient.title": "Dossiers Patients",
    "patient.subtitle": "Gérez vos antécédents médicaux chiffrés sur le réseau Sui",
    "patient.upload": "Télécharger Dossier",
    "patient.totalRecords": "Total des Dossiers",
    "patient.storageUsed": "Stockage Utilisé",
    "patient.activeShares": "Partages Actifs",
    "patient.recordsListTitle": "Vos Radiographies",
    "patient.wallet": "Portefeuille",
    "footer.poweredBy": "Propulsé par",

    // Doctor Portal
    "doctor.profile.specialty": "Radiologue Senior",
    "doctor.profile.id": "ID",
    "doctor.profile.hospital": "Hôpital",
    "doctor.nav.inbox": "Boîte de réception",
    "doctor.nav.patients": "Mes Patients",
    "doctor.nav.settings": "Paramètres",
    "doctor.incoming.title": "Demandes Entrantes",
    "doctor.incoming.pending": "en attente",
    "doctor.incoming.accept": "Accepter la Clé",
    "doctor.action.decrypt": "Déchiffrer",
    "doctor.action.decrypting": "Déchiffrement...",
    "doctor.status.encrypted": "Dossier Chiffré",
    "doctor.viewer.encryptedMessage": "Ce dossier est chiffré. Veuillez déchiffrer pour voir l'imagerie et les détails du patient.",
    "doctor.viewer.placeholder": "Visualiseur Rayons X",
    "doctor.metadata.title": "Métadonnées",
    "doctor.metadata.name": "Nom du Patient",
    "doctor.metadata.age": "Âge",
    "doctor.metadata.studyDate": "Date d'Examen",
    "doctor.metadata.modality": "Modalité",
    "doctor.metadata.bodyPart": "Partie du Corps",
    "doctor.metadata.institution": "Institution",

    // Upload Modal
    "upload.title": "Télécharger Imagerie Diagnostique",
    "upload.subtitle": "Stockage sécurisé sur Walrus",
    "upload.dragDrop": "Glissez les fichiers DICOM ici",
    "upload.description": "Les fichiers sont chiffrés et stockés sur Walrus. Vous recevez le NFT de propriété.",
    "upload.dateScan": "Date du Scan",
    "upload.bodyPart": "Partie du Corps",
    "upload.selectPlaceholder": "Sélectionner la partie du corps",
    "upload.submit": "Chiffrer et Créer le Dossier",

    // Body Parts
    "body.chest": "Poitrine",
    "body.head": "Tête",
    "body.abdomen": "Abdomen",
    "body.knee": "Genou",
    "body.hand": "Main",
    "body.foot": "Pied",
    "body.spine": "Colonne",
  }
};
