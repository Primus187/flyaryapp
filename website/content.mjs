// Visitor-facing content, DE / FR / EN. Screenshots use fictional sample data.
// Positioning: Flyary is a flight diary (memories · progress · together), not just a logbook.
export const languages = {
  "de": "Deutsch",
  "fr": "Français",
  "en": "English"
};

export const content = {
  "de": {
    "title": "Flyary – Dein Flugtagebuch fürs Gleitschirm- und Deltafliegen",
    "description": "Mehr als ein Flugbuch: Flyary hält Erinnerungen, Fortschritt und die Menschen deiner Flüge zusammen, vom ersten Schulflug an. Für Piloten und Flugschulen.",
    "skip": "Zum Inhalt",
    "claim": "Jeder Flug verdient seine Geschichte.",
    "menu": "Menü öffnen",
    "close": "Menü schliessen",
    "language": "Sprache wählen",
    "nav": [
      "Das Flugtagebuch",
      "Für Flugschulen",
      "Fragen"
    ],
    "open": "Zum Login",
    "start": "Als Pilot mitfliegen",
    "secondary": "Demo für Flugschulen",
    "tabsLabel": "App-Ansicht auswählen",
    "tabs": [
      "Erinnerungen",
      "Fortschritt",
      "Flugschule",
      "Gemeinsam"
    ],
    "tabDescriptions": [
      "Track, Fotos und Notizen",
      "Ziele, Statistik, Ausbildung",
      "Bestätigt und kommentiert",
      "Gruppen, Feed, Nachrichten"
    ],
    "panels": [
      [
        "Jeder Flug, wie er war.",
        "Track, Fotos, Videos und deine Notizen gehören zusammen. Öffne einen Flug und du bist wieder am Startplatz.",
        [
          "Track & Karte",
          "Fotos & Videos",
          "Deine Notizen"
        ]
      ],
      [
        "Sieh, wie du wächst.",
        "Dein Ausbildungsstand von der Grundausbildung bis zum Pilotenbrevet, das Kontrollblatt passend zu deiner Stufe und persönliche Saisonziele. Als Pilot kannst du weitere Brevets und Ausbildungsziele festhalten.",
        [
          "Saisonziele",
          "Statistik",
          "Ausbildungsstand"
        ]
      ],
      [
        "Deine Schule schreibt mit.",
        "Übernimm freigegebene Schulflüge in dein Tagebuch und behalte die Rückmeldung deiner Fluglehrerin beim Flug.",
        [
          "Bestätigte Schulflüge",
          "Rückmeldungen",
          "Ausdruck zum Stempeln"
        ]
      ],
      [
        "Fliegen ist schöner zusammen.",
        "Verabrede dich zum Flugtag, teile ausgewählte Flüge im Feed und tausche dich in deiner Gruppe aus.",
        [
          "Gruppen & Termine",
          "Feed",
          "Nachrichten"
        ]
      ]
    ],
    "screenLanguage": "Ansichten auf Deutsch",
    "previewAlt": [
      "Ein Flug mit Flugdaten, persönlichem Kommentar und Fotos",
      "Ausbildungsstand nach SHV-Weisung mit bestätigten Höhenflügen, Start- und Landeplätzen",
      "Ein Flug mit Bestätigung durch die Flugschule und Notiz des Fluglehrers",
      "Feed mit einem geteilten Flug, einer Reaktion und einem Kommentar"
    ],
    "pilotIntro": "Der Track liegt im Vario, das Foto auf dem Handy, die Rückmeldung irgendwo im Chat. In Flyary wird daraus eine Geschichte: dein Flug, vollständig und wiederauffindbar.",
    "schoolTitle": "Hier beginnt\ndas Flugtagebuch.",
    "schoolIntro": "Für eure Schüler beginnt ihr Flugtagebuch mit dem ersten Schulflug. Für euch heisst das weniger Papier am Landeplatz: Planung, Flugtag und Ausbildungsnachweis in einer App, und jeder Schüler kennt seinen Stand.",
    "schoolFeatures": [
      [
        "Vor dem Flugtag",
        "Termine planen, Anmeldungen sehen, Team einteilen."
      ],
      [
        "Am Start- und Landeplatz",
        "Check-in, Starts mit optionaler Start-Ansage, Landungen und Rückmeldungen im Flugtag-Cockpit."
      ],
      [
        "Nach der Landung",
        "Flüge gesammelt bestätigen, Ausbildungsstand verfolgen, Nachweis zum Stempeln ausgeben."
      ]
    ],
    "schoolCta": "Demo für eure Flugschule vereinbaren",
    "schoolNote": "Persönliche Demo mit Tobias, danach vereinbaren wir gemeinsam den Einstieg in die Pilotphase.",
    "schoolImageAlt": "Flugtag-Cockpit mit Ausbildungsblatt und Rückmeldung zum Schulflug",
    "aboutTitle": "Die Flyary Story",
    "aboutVideoPlay": "Video abspielen: Die Flyary Story",
    "faqTitle": "Häufige Fragen.",
    "faqs": [
      [
        "Was ist ein Flugtagebuch?",
        "Ein Flugbuch hält Daten fest. Ein Flugtagebuch hält den ganzen Flug fest: Track, Fotos, Notizen, die Rückmeldung deiner Schule und wie du dich entwickelst."
      ],
      [
        "Wie werde ich Testpilot?",
        "Trag dich über das Formular ein. Sobald wir weitere Testpiloten aufnehmen, bekommst du einen persönlichen Link per E-Mail."
      ],
      [
        "Wie steigen wir als Flugschule ein?",
        "Mit einer persönlichen Demo. Danach richten wir eure Schule mit Team und Schülern gemeinsam ein."
      ],
      [
        "Muss ich eine App installieren?",
        "Nein. Flyary läuft im Browser auf Smartphone, Tablet und Computer. Auf unterstützten Geräten kannst du die Web-App zusätzlich auf deinem Startbildschirm installieren."
      ],
      [
        "Kann ich mein bisheriges Flugbuch übernehmen?",
        "Ja, aus gängigen Tabellenformaten. IGC-Dateien liest Flyary direkt ein."
      ],
      [
        "Zählt Flyary für meine Prüfung?",
        "Flyary zeigt deinen Ausbildungsstand nach den aktuellen SHV-Weisungen und erstellt einen Ausdruck, den deine Flugschule stempelt und unterschreibt. Über die Zulassung entscheiden die Prüfungsexperten."
      ],
      [
        "Gehören meine Daten mir?",
        "Ja. Du bestimmst, welche Flüge du veröffentlichst. PDF, CSV, Excel und ein ZIP-Archiv mit IGC-Dateien stehen für den Export bereit; Fotos kannst du im Archiv ergänzen. Die Daten liegen in der Schweiz."
      ],
      [
        "Was kostet Flyary?",
        "Die Konditionen der Pilotphase besprechen wir persönlich."
      ]
    ],
    "finalTitle": "Dein nächster Flug\nverdient mehr als eine Zeile.",
    "finalNote": "Pilotphase mit ausgewählten Flugschulen und Testpiloten.",
    "footerText": "Das Flugtagebuch fürs Gleitschirm- und Deltafliegen.",
    "contact": "Kontakt",
    "privacy": "Datenschutz & Impressum",
    "terms": "Nutzungsbedingungen",
    "top": "Nach oben",
    "emailSubject": "Demo für unsere Flugschule",
    "copyright": "Tobias Bolliger",
    "explorerTitle": "Alles, was zu deinen Flügen gehört.",
    "sampleNote": "Alle App-Ansichten zeigen Beispieldaten.",
    "signup": {
      "title": "Testpilot werden – Flyary",
      "description": "Trag dich für die Pilotphase von Flyary ein, dem Flugtagebuch fürs Gleitschirm- und Deltafliegen.",
      "heading": [
        "Als Pilot",
        "mitfliegen."
      ],
      "intro": "Flyary ist in der Pilotphase mit ausgewählten Flugschulen und Testpiloten. Trag dich ein, wir melden uns, sobald wir weitere Testpiloten aufnehmen.",
      "points": [
        "Wir melden uns persönlich per E-Mail.",
        "Deine Rückmeldungen fliessen direkt in die Entwicklung ein.",
        "Deine Angaben verwenden wir nur für die Pilotphase."
      ],
      "formTitle": "Deine Angaben",
      "name": "Name",
      "email": "E-Mail",
      "role": "Ich bin",
      "roles": {
        "student": "Schüler",
        "pilot": "Pilot",
        "tandem_pilot": "Tandempilot",
        "instructor": "Fluglehrer"
      },
      "disciplines": "Ich fliege",
      "discipline": {
        "paraglider": "Gleitschirm",
        "hangglider": "Delta"
      },
      "school": "Flugschule",
      "comment": "Kommentar",
      "optional": "optional",
      "commentPlaceholder": "Zum Beispiel: Ich möchte meine Schulflüge mit Fotos festhalten …",
      "consent": "Ich bin einverstanden, dass Flyary mich zur Pilotphase kontaktiert. Meine Angaben werden nur dafür verwendet und auf Wunsch gelöscht.",
      "privacy": "Datenschutz",
      "honeypot": "Website (bitte leer lassen)",
      "submit": "Eintragen",
      "errors": {
        "invalid": "Bitte prüfe deine Angaben: Name, eine gültige E-Mail-Adresse, deine Rolle und die Einwilligung sind nötig.",
        "rate_limited": "Gerade kommen sehr viele Anmeldungen an. Bitte versuche es in einer Stunde noch einmal.",
        "error": "Das hat leider nicht geklappt. Bitte versuche es später noch einmal oder schreib uns eine E-Mail."
      }
    },
    "thanks": {
      "title": "Danke – Flyary",
      "heading": [
        "Danke!",
        "Du stehst auf der Testliste."
      ],
      "text": "Sobald wir weitere Testpiloten aufnehmen, schicken wir dir deinen persönlichen Link per E-Mail. Bis dahin: guten Flug.",
      "back": "Zurück zur Startseite"
    }
  },
  "fr": {
    "title": "Flyary – Votre journal de vol pour le parapente et le delta",
    "description": "Plus qu’un carnet de vol : Flyary réunit les souvenirs, la progression et les personnes de vos vols, dès le premier vol d’école. Pour les pilotes et les écoles.",
    "skip": "Aller au contenu",
    "claim": "Chaque vol mérite son histoire.",
    "menu": "Ouvrir le menu",
    "close": "Fermer le menu",
    "language": "Choisir la langue",
    "nav": [
      "Le journal de vol",
      "Pour les écoles",
      "Questions"
    ],
    "open": "Se connecter",
    "start": "Devenir pilote test",
    "secondary": "Démo pour les écoles",
    "tabsLabel": "Choisir une vue de l’application",
    "tabs": [
      "Souvenirs",
      "Progression",
      "École",
      "Ensemble"
    ],
    "tabDescriptions": [
      "Trace, photos et notes",
      "Objectifs, statistiques, formation",
      "Confirmé et commenté",
      "Groupes, fil, messages"
    ],
    "panels": [
      [
        "Chaque vol, tel qu’il était.",
        "Trace, photos, vidéos et vos notes vont ensemble. Ouvrez un vol et vous voilà de retour au décollage.",
        [
          "Trace et carte",
          "Photos et vidéos",
          "Vos notes"
        ]
      ],
      [
        "Voyez comment vous progressez.",
        "Votre niveau, de la formation de base au brevet de pilote, une fiche de contrôle adaptée à votre étape et vos objectifs de saison. Après le brevet, gardez vos autres brevets et objectifs de formation au même endroit.",
        [
          "Objectifs de saison",
          "Statistiques",
          "Niveau de formation"
        ]
      ],
      [
        "Votre école écrit avec vous.",
        "Reprenez les vols d’école validés dans votre journal et gardez les retours de votre monitrice avec le vol.",
        [
          "Vols d’école confirmés",
          "Retours",
          "Impression à tamponner"
        ]
      ],
      [
        "Voler, c’est plus beau ensemble.",
        "Donnez-vous rendez-vous pour une journée de vol, partagez certains vols dans le fil et échangez dans votre groupe.",
        [
          "Groupes et sorties",
          "Fil",
          "Messages"
        ]
      ]
    ],
    "screenLanguage": "Captures en allemand",
    "previewAlt": [
      "Un vol avec ses données, un commentaire personnel et des photos",
      "Niveau de formation selon la directive FSVL avec vols d’altitude, décollages et atterrissages confirmés",
      "Un vol confirmé par l’école avec une note du moniteur",
      "Fil d’actualité avec un vol partagé, une réaction et un commentaire"
    ],
    "pilotIntro": "La trace est dans le vario, la photo sur le téléphone, le retour quelque part dans une conversation. Dans Flyary, tout cela devient une histoire : votre vol, complet et facile à retrouver.",
    "schoolTitle": "Ici commence\nle journal de vol.",
    "schoolIntro": "Pour vos élèves, le journal de vol commence avec le premier vol d’école. Pour vous, cela signifie moins de papier à l’atterrissage : planification, journée de vol et justificatif de formation dans une seule app, et chaque élève connaît son niveau.",
    "schoolFeatures": [
      [
        "Avant la journée de vol",
        "Planifier les sorties, voir les inscriptions, répartir l’équipe."
      ],
      [
        "Au décollage et à l’atterrissage",
        "Présences, décollages avec annonce vocale en option, atterrissages et retours dans le cockpit de la journée."
      ],
      [
        "Après l’atterrissage",
        "Confirmer les vols en une fois, suivre le niveau de formation, imprimer le justificatif à tamponner."
      ]
    ],
    "schoolCta": "Convenir d’une démo pour votre école",
    "schoolNote": "Démo personnalisée avec Tobias, puis nous convenons ensemble de votre entrée dans la phase pilote.",
    "schoolImageAlt": "Cockpit du jour de vol avec fiche de formation et retour sur le vol école",
    "aboutTitle": "L’histoire de Flyary",
    "aboutVideoPlay": "Lire la vidéo : L’histoire de Flyary",
    "faqTitle": "Questions fréquentes.",
    "faqs": [
      [
        "Qu’est-ce qu’un journal de vol ?",
        "Un carnet de vol enregistre des données. Un journal de vol garde tout le vol : trace, photos, notes, le retour de votre école et votre progression."
      ],
      [
        "Comment devenir pilote test ?",
        "Inscrivez-vous via le formulaire. Dès que nous accueillons de nouveaux pilotes test, vous recevez un lien personnel par e-mail."
      ],
      [
        "Comment notre école peut-elle commencer ?",
        "Par une démo personnalisée. Ensuite, nous configurons ensemble votre école avec l’équipe et les élèves."
      ],
      [
        "Faut-il installer une application ?",
        "Non. Flyary fonctionne dans le navigateur sur téléphone, tablette et ordinateur. Sur les appareils compatibles, vous pouvez aussi installer l’application web sur votre écran d’accueil."
      ],
      [
        "Puis-je reprendre mon carnet de vol actuel ?",
        "Oui, depuis les formats de tableaux courants. Flyary lit directement les fichiers IGC."
      ],
      [
        "Flyary compte-t-il pour mon examen ?",
        "Flyary affiche votre niveau de formation selon les directives actuelles de la FSVL et crée une impression que votre école tamponne et signe. L’admission est décidée par les experts d’examen."
      ],
      [
        "Mes données m’appartiennent-elles ?",
        "Oui. Vous choisissez les vols à publier. Exportez en PDF, CSV ou Excel, ou créez une archive ZIP avec les fichiers IGC et, en option, les photos. Les données sont hébergées en Suisse."
      ],
      [
        "Combien coûte Flyary ?",
        "Nous discutons personnellement des conditions de la phase pilote."
      ]
    ],
    "finalTitle": "Votre prochain vol\nmérite plus qu’une ligne.",
    "finalNote": "Phase pilote avec des écoles et des pilotes test sélectionnés.",
    "footerText": "Le journal de vol pour le parapente et le delta.",
    "contact": "Contact",
    "privacy": "Confidentialité & mentions légales",
    "terms": "Conditions d’utilisation",
    "top": "Retour en haut",
    "emailSubject": "Démo pour notre école de vol libre",
    "copyright": "Tobias Bolliger",
    "explorerTitle": "Tout ce qui appartient à vos vols.",
    "sampleNote": "Toutes les vues de l’app montrent des données d’exemple.",
    "signup": {
      "title": "Devenir pilote test – Flyary",
      "description": "Inscrivez-vous à la phase pilote de Flyary, le journal de vol pour le parapente et le delta.",
      "heading": [
        "Devenez",
        "pilote test."
      ],
      "intro": "Flyary est en phase pilote avec des écoles et des pilotes test sélectionnés. Inscrivez-vous : nous vous contactons dès que nous accueillons de nouveaux pilotes test.",
      "points": [
        "Nous vous contactons personnellement par e-mail.",
        "Vos retours alimentent directement le développement.",
        "Vos données servent uniquement à la phase pilote."
      ],
      "formTitle": "Vos coordonnées",
      "name": "Nom",
      "email": "E-mail",
      "role": "Je suis",
      "roles": {
        "student": "Élève",
        "pilot": "Pilote",
        "tandem_pilot": "Pilote biplace",
        "instructor": "Moniteur"
      },
      "disciplines": "Je vole en",
      "discipline": {
        "paraglider": "Parapente",
        "hangglider": "Delta"
      },
      "school": "École de vol",
      "comment": "Commentaire",
      "optional": "facultatif",
      "commentPlaceholder": "Par exemple : j’aimerais garder mes vols d’école avec leurs photos …",
      "consent": "J’accepte que Flyary me contacte au sujet de la phase pilote. Mes données sont utilisées uniquement à cette fin et supprimées sur demande.",
      "privacy": "Confidentialité",
      "honeypot": "Site web (laisser vide)",
      "submit": "M’inscrire",
      "errors": {
        "invalid": "Veuillez vérifier vos données : nom, adresse e-mail valide, votre rôle et le consentement sont nécessaires.",
        "rate_limited": "Nous recevons actuellement beaucoup d’inscriptions. Veuillez réessayer dans une heure.",
        "error": "Cela n’a malheureusement pas fonctionné. Veuillez réessayer plus tard ou nous écrire un e-mail."
      }
    },
    "thanks": {
      "title": "Merci – Flyary",
      "heading": [
        "Merci !",
        "Vous êtes sur la liste."
      ],
      "text": "Dès que nous accueillons de nouveaux pilotes test, nous vous envoyons votre lien personnel par e-mail. D’ici là : bons vols.",
      "back": "Retour à l’accueil"
    }
  },
  "en": {
    "title": "Flyary – Your flight diary for paragliding and hang gliding",
    "description": "More than a logbook: Flyary keeps the memories, progress and people of your flights together, from your first school flight. For pilots and flight schools.",
    "skip": "Skip to content",
    "claim": "Every flight deserves its story.",
    "menu": "Open menu",
    "close": "Close menu",
    "language": "Choose language",
    "nav": [
      "The flight diary",
      "For schools",
      "Questions"
    ],
    "open": "Log in",
    "start": "Join as a pilot",
    "secondary": "Demo for flight schools",
    "tabsLabel": "Choose an app view",
    "tabs": [
      "Memories",
      "Progress",
      "Flight school",
      "Together"
    ],
    "tabDescriptions": [
      "Track, photos and notes",
      "Goals, statistics, training",
      "Confirmed and commented",
      "Groups, feed, messages"
    ],
    "panels": [
      [
        "Every flight, just as it was.",
        "Track, photos, videos and your notes belong together. Open a flight and you’re back at take-off.",
        [
          "Track & map",
          "Photos & videos",
          "Your notes"
        ]
      ],
      [
        "See how you grow.",
        "Your training stage from ground training to your pilot licence, a training sheet that follows your stage, and personal season goals. As a pilot, record further licences and training goals.",
        [
          "Season goals",
          "Statistics",
          "Training status"
        ]
      ],
      [
        "Your school writes along.",
        "Add released school flights to your diary and keep your instructor’s feedback with them.",
        [
          "Confirmed school flights",
          "Feedback",
          "Printout for the stamp"
        ]
      ],
      [
        "Flying is better together.",
        "Meet up for a flying day, share selected flights in the feed and talk in your group.",
        [
          "Groups & events",
          "Feed",
          "Messages"
        ]
      ]
    ],
    "screenLanguage": "Screens shown in German",
    "previewAlt": [
      "A flight with its data, a personal comment and photos",
      "Training status under the SHV directive with confirmed high-altitude flights, take-off and landing sites",
      "A flight confirmed by the flight school with a note from the instructor",
      "Feed with a shared flight, a reaction and a comment"
    ],
    "pilotIntro": "The track is on your vario, the photo on your phone, the feedback somewhere in a chat. Flyary turns it into a story: your flight, complete and easy to find.",
    "schoolTitle": "The flight diary\nstarts here.",
    "schoolIntro": "For your students, their flight diary begins with the first school flight. For you, it means less paper at the landing field: planning, the flying day and training records in one app, and every student knows where they stand.",
    "schoolFeatures": [
      [
        "Before the flying day",
        "Plan events, see sign-ups, assign your team."
      ],
      [
        "At take-off and landing",
        "Check-ins, take-offs with optional spoken announcements, landings and feedback in the flying-day cockpit."
      ],
      [
        "After landing",
        "Confirm flights in one go, follow training status, print the record for the stamp."
      ]
    ],
    "schoolCta": "Book a demo for your school",
    "schoolNote": "A personal demo with Tobias; afterwards we agree together on how you join the pilot phase.",
    "schoolImageAlt": "Flight-day cockpit with training sheet and feedback on the school flight",
    "aboutTitle": "The Flyary story",
    "aboutVideoPlay": "Play video: The Flyary story",
    "faqTitle": "Frequently asked questions.",
    "faqs": [
      [
        "What is a flight diary?",
        "A logbook records data. A flight diary keeps the whole flight: track, photos, notes, your school’s feedback and how you develop."
      ],
      [
        "How do I become a test pilot?",
        "Sign up with the form. As soon as we take on more test pilots, you’ll get a personal link by e-mail."
      ],
      [
        "How does our flight school get started?",
        "With a personal demo. Afterwards we set up your school with team and students together."
      ],
      [
        "Do I need to install an app?",
        "No. Flyary works in your browser on phones, tablets and computers. On supported devices you can also install the web app on your home screen."
      ],
      [
        "Can I bring my current logbook?",
        "Yes, from common spreadsheet formats. Flyary reads IGC files directly."
      ],
      [
        "Does Flyary count for my exam?",
        "Flyary shows your training status under the current SHV directives and creates a printout that your flight school stamps and signs. The examiners decide on admission."
      ],
      [
        "Does my data belong to me?",
        "Yes. You choose which flights to publish. Export as PDF, CSV or Excel, or save a ZIP archive with IGC files and optional photos. The data is stored in Switzerland."
      ],
      [
        "How much does Flyary cost?",
        "We discuss the terms of the pilot phase personally."
      ]
    ],
    "finalTitle": "Your next flight\ndeserves more than one line.",
    "finalNote": "Pilot phase with selected flight schools and test pilots.",
    "footerText": "The flight diary for paragliding and hang gliding.",
    "contact": "Contact",
    "privacy": "Privacy & legal notice",
    "terms": "Terms of use",
    "top": "Back to top",
    "emailSubject": "Demo for our flight school",
    "copyright": "Tobias Bolliger",
    "explorerTitle": "Everything that belongs to your flights.",
    "sampleNote": "All app views show sample data.",
    "signup": {
      "title": "Become a test pilot – Flyary",
      "description": "Sign up for the pilot phase of Flyary, the flight diary for paragliding and hang gliding.",
      "heading": [
        "Join as",
        "a pilot."
      ],
      "intro": "Flyary is in its pilot phase with selected flight schools and test pilots. Sign up and we’ll get in touch as soon as we take on more test pilots.",
      "points": [
        "We get in touch personally by e-mail.",
        "Your feedback goes straight into development.",
        "We use your details only for the pilot phase."
      ],
      "formTitle": "Your details",
      "name": "Name",
      "email": "E-mail",
      "role": "I am a",
      "roles": {
        "student": "Student",
        "pilot": "Pilot",
        "tandem_pilot": "Tandem pilot",
        "instructor": "Instructor"
      },
      "disciplines": "I fly",
      "discipline": {
        "paraglider": "Paraglider",
        "hangglider": "Hang glider"
      },
      "school": "Flight school",
      "comment": "Comment",
      "optional": "optional",
      "commentPlaceholder": "For example: I’d like to keep my school flights together with photos …",
      "consent": "I agree that Flyary may contact me about the pilot phase. My details are used only for this and deleted on request.",
      "privacy": "Privacy",
      "honeypot": "Website (leave empty)",
      "submit": "Sign up",
      "errors": {
        "invalid": "Please check your details: name, a valid e-mail address, your role and your consent are required.",
        "rate_limited": "We are receiving a lot of sign-ups right now. Please try again in an hour.",
        "error": "Sorry, that didn’t work. Please try again later or send us an e-mail."
      }
    },
    "thanks": {
      "title": "Thank you – Flyary",
      "heading": [
        "Thank you!",
        "You’re on the test list."
      ],
      "text": "As soon as we take on more test pilots, we’ll e-mail you your personal link. Until then: happy flying.",
      "back": "Back to the home page"
    }
  }
};
