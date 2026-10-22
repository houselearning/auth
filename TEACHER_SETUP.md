# HouseLearning Teacher Workspace

The teacher workspace lives at `/auth/teacher.html`. It uses Firebase Authentication custom claims, Cloud Functions, and Firestore from the existing HouseLearning Firebase project. Student users continue to use the existing student dashboard and can request teacher access or join a class.

## Access Model

Every new account is a student by default. A signed-in, email-verified user submits a teacher application. Only an administrator can approve or reject it. Approval sets the Firebase Auth custom claim `role: "teacher"`; users cannot grant themselves teacher or admin access by editing `user_profiles` or `cookbook_users`. After approval, the user selects **Refresh teacher access** to reload their ID token.

The existing Firebase admin claim and the project's current explicit admin allowlist remain authoritative for application review. Do not add admin claims or teacher claims to client code.

The old Google Apps Script source is not in the checked-out repositories. The legacy student class stream/join path remains available, but the auth dashboard no longer uses that endpoint for teacher class management, roster, settings, or assignment fallback. Existing spreadsheet-backed teacher data is not migrated automatically; approved teachers should recreate active classes in the new Firestore workspace.

## Firestore Model

- `teacherApplications/{uid}` stores the application and admin decision. Users may submit or resubmit a rejected application; only admins may approve/reject.
- `classes/{classId}` stores the lead teacher, co-teacher UIDs, name, description, and archived state.
- `classes/{classId}/members/{studentUid}` stores membership. Only callable Functions may create/remove memberships.
- `teacherClassInvites/{code}` stores a private join-code mapping. Client reads and writes are denied.
- `assignments/{assignmentId}` stores class work, due date, points, HTTPS resource links, and draft/published state.
- `assignments/{assignmentId}/submissions/{studentUid}` stores student responses and instructor-only grades/feedback.
- Class subcollections `announcements`, `materials`, and `sessions` store communications, HTTPS resource links, and scheduled meetings.

Student work and class data are scoped by Firestore rules. Permanent class deletion is lead-teacher-only and removes class members, announcements, materials, sessions, invitations, assignments, and submissions. Archiving is reversible and retains data.

## No-Cost Design

The portal does not upload files to Cloud Storage. Teachers attach resources as HTTPS links, avoiding a new Storage dependency. Firebase Auth, Firestore, and Functions are existing dependencies; Firebase's free quotas are not a guarantee of zero cost, so monitor usage and billing settings before production deployment.

## Deploy and Test

The complete rules file is [houselearning-home/firestore.rules](../houselearning-home/firestore.rules), with the matching assignment index in `houselearning-home/firestore.indexes.json`. Deploy the rules/indexes before exposing the portal:

```sh
firebase deploy --only firestore:rules,firestore:indexes
```

Deploy the teacher callable functions from `houselearning-home`:

```sh
firebase deploy --only functions:reviewTeacherApplication,functions:createTeacherClass,functions:getTeacherClassCode,functions:joinTeacherClass,functions:setTeacherCoTeachers,functions:removeTeacherStudent,functions:deleteTeacherAssignment,functions:deleteTeacherClass
```

Run local checks from `houselearning-home`:

```sh
npm --prefix functions test
python3 -m unittest discover -s tests -p 'test_teacher_firestore_rules.py' -v
```

The rules tests currently use static policy assertions. Run the Firebase Emulator Suite rules tests before production; the Firebase CLI/emulator is not installed in the current environment.
