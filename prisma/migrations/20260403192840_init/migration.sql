-- CreateEnum
CREATE TYPE "StatutReservation" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'BLOQUEE', 'ANNULEE', 'REFUSEE', 'TERMINEE');

-- CreateEnum
CREATE TYPE "TypeNotification" AS ENUM ('CONFIRMATION_RESERVATION', 'ANNULATION_RESERVATION', 'CONFIRMATION_ANNULATION', 'RAPPEL', 'PROMOTION', 'RECLAMATION');

-- CreateEnum
CREATE TYPE "StatutReclamation" AS ENUM ('OUVERTE', 'EN_COURS', 'RESOLUE', 'FERMEE');

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "dateInscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT,
    "adresse" TEXT,
    "nationalite" TEXT,
    "photo" TEXT,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agences_voyage" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "nomAgence" TEXT NOT NULL,
    "siret" TEXT NOT NULL,
    "adresseAgence" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "agences_voyage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotels" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "pays" TEXT NOT NULL,
    "etoiles" INTEGER NOT NULL,
    "description" TEXT,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "estPartenaire" BOOLEAN NOT NULL DEFAULT false,
    "agenceVoyageId" INTEGER NOT NULL,

    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "types_chambre" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "superficieM2" DOUBLE PRECISION NOT NULL,
    "equipements" TEXT[],

    CONSTRAINT "types_chambre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chambres" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "etage" INTEGER NOT NULL,
    "prixParNuit" DOUBLE PRECISION NOT NULL,
    "capacite" INTEGER NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "photos" TEXT[],
    "hotelId" INTEGER NOT NULL,
    "typeChambreId" INTEGER NOT NULL,

    CONSTRAINT "chambres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "chambreId" INTEGER NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateArrivee" TIMESTAMP(3) NOT NULL,
    "dateDepart" TIMESTAMP(3) NOT NULL,
    "nombrePersonnes" INTEGER NOT NULL,
    "nombreNuits" INTEGER NOT NULL,
    "montantTotal" DOUBLE PRECISION NOT NULL,
    "codeConfirmation" TEXT NOT NULL,
    "statut" "StatutReservation" NOT NULL DEFAULT 'EN_ATTENTE',
    "motifBlocage" TEXT,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offres" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "tauxRemise" DOUBLE PRECISION NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hotelId" INTEGER NOT NULL,

    CONSTRAINT "offres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offres_chambres" (
    "offreId" INTEGER NOT NULL,
    "chambreId" INTEGER NOT NULL,

    CONSTRAINT "offres_chambres_pkey" PRIMARY KEY ("offreId","chambreId")
);

-- CreateTable
CREATE TABLE "avis" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "note" INTEGER NOT NULL,
    "commentaire" TEXT,
    "datePublication" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valide" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "avis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "type" "TypeNotification" NOT NULL,
    "dateEnvoi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lu" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reclamations" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "agenceVoyageId" INTEGER NOT NULL,
    "sujet" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dateOuverture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateResolution" TIMESTAMP(3),
    "reponseAgence" TEXT,
    "statut" "StatutReclamation" NOT NULL DEFAULT 'OUVERTE',

    CONSTRAINT "reclamations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditions_annulation" (
    "id" SERIAL NOT NULL,
    "delaiLimiteHeures" INTEGER NOT NULL,
    "fraisAnnulation" DOUBLE PRECISION NOT NULL,
    "remboursementTotal" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "systemConfigId" INTEGER NOT NULL,

    CONSTRAINT "conditions_annulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" SERIAL NOT NULL,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_accountId_key" ON "profiles"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "agences_voyage_email_key" ON "agences_voyage"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agences_voyage_siret_key" ON "agences_voyage"("siret");

-- CreateIndex
CREATE UNIQUE INDEX "types_chambre_libelle_key" ON "types_chambre"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "chambres_hotelId_numero_key" ON "chambres"("hotelId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_codeConfirmation_key" ON "reservations"("codeConfirmation");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_cle_key" ON "system_configs"("cle");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_agenceVoyageId_fkey" FOREIGN KEY ("agenceVoyageId") REFERENCES "agences_voyage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chambres" ADD CONSTRAINT "chambres_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chambres" ADD CONSTRAINT "chambres_typeChambreId_fkey" FOREIGN KEY ("typeChambreId") REFERENCES "types_chambre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_chambreId_fkey" FOREIGN KEY ("chambreId") REFERENCES "chambres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offres" ADD CONSTRAINT "offres_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offres_chambres" ADD CONSTRAINT "offres_chambres_offreId_fkey" FOREIGN KEY ("offreId") REFERENCES "offres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offres_chambres" ADD CONSTRAINT "offres_chambres_chambreId_fkey" FOREIGN KEY ("chambreId") REFERENCES "chambres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis" ADD CONSTRAINT "avis_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamations" ADD CONSTRAINT "reclamations_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamations" ADD CONSTRAINT "reclamations_agenceVoyageId_fkey" FOREIGN KEY ("agenceVoyageId") REFERENCES "agences_voyage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditions_annulation" ADD CONSTRAINT "conditions_annulation_systemConfigId_fkey" FOREIGN KEY ("systemConfigId") REFERENCES "system_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
