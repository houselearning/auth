import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
  addDoc, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, orderBy,
  query, serverTimestamp, setDoc, Timestamp, updateDoc, where
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw',
  authDomain: 'contract-center-llc-10.firebaseapp.com',
  projectId: 'contract-center-llc-10',
  storageBucket: 'contract-center-llc-10.firebasestorage.app',
  messagingSenderId: '323221512767',
  appId: '1:323221512767:web:6421260f875997dbf64e8a'
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'us-central1');
const call = name => httpsCallable(functions, name);
const byId = id => document.getElementById(id);
const pageStatus = byId('page-status');
const accessPanel = byId('access-panel');
const teacherPanel = byId('teacher-panel');
const applicationForm = byId('application-form');
const applicationState = byId('application-state');
const joinClassForm = byId('join-class-form');
const studentClassList = byId('student-class-list');
const studentAssignmentList = byId('student-assignment-list');
const studentFeedList = byId('student-feed-list');
const teacherClassList = byId('teacher-class-list');
const classDetails = byId('class-details');
const classEmptyState = byId('class-empty-state');
const workspaceContent = byId('workspace-content');
let currentUser = null;
let currentClass = null;
let currentTab = 'overview';
let teacherClasses = [];
let studentClasses = [];
let rosterById = new Map();

function setStatus(message, kind = '') {
  pageStatus.textContent = message;
  pageStatus.dataset.kind = kind;
}

function element(tag, text, className = '') {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function makeButton(text, action, className = 'secondary-button') {
  const button = element('button', text, className);
  button.type = 'button';
  button.addEventListener('click', action);
  return button;
}

function makeField(labelText, name, { type = 'text', value = '', required = false, maxLength, rows } = {}) {
  const label = element('label', labelText);
  const field = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  if (type !== 'textarea') field.type = type;
  if (rows) field.rows = rows;
  field.name = name;
  field.value = value;
  field.required = required;
  if (maxLength) field.maxLength = maxLength;
  label.htmlFor = `field-${name}`;
  field.id = `field-${name}`;
  return { label, field };
}

function showApplicationNotice(message) {
  applicationState.replaceChildren(element('p', message));
  applicationState.hidden = false;
}

function dateText(value) {
  if (!value) return 'No date set';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
}

function datetimeLocalValue(value) {
  if (!value) return '';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function safeHttpsLinks(value) {
  return String(value || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const url = new URL(line);
    if (url.protocol !== 'https:') throw new Error('Resource links must use HTTPS.');
    return url.href;
  });
}

function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

async function signedInUser() {
  if (!currentUser) throw new Error('Sign in to continue.');
  return currentUser;
}

function showStudentApplication() {
  accessPanel.hidden = false;
  teacherPanel.hidden = true;
  byId('application-form').hidden = false;
  byId('join-class-form').hidden = false;
  byId('student-classes').hidden = false;
  byId('student-work').hidden = false;
}

async function loadApplication() {
  const applicationRef = doc(db, 'teacherApplications', currentUser.uid);
  const snapshot = await getDoc(applicationRef);
  if (!snapshot.exists()) {
    applicationForm.hidden = !currentUser.emailVerified;
    if (!currentUser.emailVerified) showApplicationNotice('Verify your email before requesting teacher access.');
    return;
  }

  const application = snapshot.data();
  applicationForm.hidden = application.status !== 'rejected' || !currentUser.emailVerified;
  if (application.status === 'approved') {
    const message = element('p', 'Your teacher access is approved. Refresh your permissions to open the workspace.');
    const refresh = makeButton('Refresh teacher access', async event => {
      event.currentTarget.disabled = true;
      try {
        await currentUser.getIdToken(true);
        await initializeUser(currentUser);
      } catch (error) {
        showApplicationNotice(error.message || 'Could not refresh teacher access.');
      }
    }, 'primary-button');
    applicationState.replaceChildren(message, refresh);
    applicationState.hidden = false;
    return;
  }
  showApplicationNotice(application.status === 'rejected'
    ? `Your application was declined.${application.reviewNote ? ` Note: ${application.reviewNote}` : ''} You can update it and submit again.`
    : 'Your teacher access request is waiting for administrator review.');
}

applicationForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = applicationForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    if (!currentUser.emailVerified) throw new Error('Verify your email before applying.');
    const applicationRef = doc(db, 'teacherApplications', currentUser.uid);
    const previous = await getDoc(applicationRef);
    const data = {
      userId: currentUser.uid,
      email: currentUser.email,
      displayName: byId('teacher-name').value.trim(),
      school: byId('teacher-school').value.trim(),
      experience: byId('teacher-experience').value.trim(),
      status: 'pending',
      submittedAt: serverTimestamp()
    };
    if (previous.exists()) await updateDoc(applicationRef, data);
    else await setDoc(applicationRef, data);
    applicationForm.reset();
    applicationForm.hidden = true;
    showApplicationNotice('Application submitted. An administrator must approve teacher access.');
  } catch (error) {
    showApplicationNotice(error.message || 'Could not submit the application.');
  } finally {
    submit.disabled = false;
  }
});

joinClassForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = joinClassForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await signedInUser();
    const result = await call('joinTeacherClass')({ joinCode: byId('join-code').value.trim().toUpperCase() });
    byId('join-code').value = '';
    setStatus(`Joined ${result.data.className}.`, 'success');
    await loadStudentClasses();
  } catch (error) {
    setStatus(error.message || 'Could not join that class.', 'error');
  } finally {
    submit.disabled = false;
  }
});

byId('join-code').addEventListener('input', event => {
  event.currentTarget.value = event.currentTarget.value.toUpperCase();
});

async function loadStudentClasses() {
  studentClassList.replaceChildren(element('p', 'Loading your classes…', 'list-item-meta'));
  studentAssignmentList.replaceChildren();
  try {
    const memberships = await getDocs(query(
      collectionGroup(db, 'members'),
      where('studentId', '==', currentUser.uid)
    ));
    studentClasses = [];
    for (const membership of memberships.docs) {
      const classId = membership.ref.parent.parent.id;
      const classSnapshot = await getDoc(doc(db, 'classes', classId));
      if (classSnapshot.exists() && classSnapshot.data().archived !== true) {
        studentClasses.push({ id: classId, ...classSnapshot.data() });
      }
    }
    studentClassList.replaceChildren();
    if (!studentClasses.length) {
      studentClassList.append(element('p', 'You have not joined a class yet.', 'list-item-meta'));
      studentAssignmentList.replaceChildren(element('p', 'Join a class to see published assignments.', 'list-item-meta'));
      return;
    }
    studentClasses.sort((left, right) => left.name.localeCompare(right.name));
    for (const classItem of studentClasses) {
      const card = element('article', undefined, 'list-item');
      card.append(element('h3', classItem.name), element('p', classItem.description || 'Class workspace', 'list-item-meta'));
      card.append(makeButton('View class work and updates', async () => {
        await Promise.all([loadStudentAssignments(classItem), loadStudentClassUpdates(classItem)]);
      }, 'primary-button'));
      studentClassList.append(card);
    }
    await Promise.all([loadStudentAssignments(studentClasses[0]), loadStudentClassUpdates(studentClasses[0])]);
  } catch (error) {
    studentClassList.replaceChildren(element('p', error.message || 'Could not load your classes.', 'list-item-meta'));
  }
}

async function loadStudentClassUpdates(classItem) {
  byId('student-class-feed').hidden = false;
  studentFeedList.replaceChildren(element('p', 'Loading class updates…', 'list-item-meta'));
  try {
    const [announcements, materials, sessions] = await Promise.all([
      getDocs(query(collection(db, 'classes', classItem.id, 'announcements'), orderBy('createdAt', 'desc'), limit(25))),
      getDocs(query(collection(db, 'classes', classItem.id, 'materials'), orderBy('createdAt', 'desc'), limit(50))),
      getDocs(query(collection(db, 'classes', classItem.id, 'sessions'), orderBy('startsAt', 'asc'), limit(25)))
    ]);
    const cards = [];
    for (const item of announcements.docs) {
      const card = element('article', undefined, 'announcement-card');
      card.append(element('h3', 'Announcement'), element('p', item.data().body), element('p', dateText(item.data().createdAt), 'list-item-meta'));
      cards.push(card);
    }
    for (const item of materials.docs) {
      const card = element('article', undefined, 'material-card');
      card.append(element('h3', item.data().title), element('p', item.data().kind, 'list-item-meta'));
      try {
        const url = new URL(item.data().url);
        if (url.protocol === 'https:') {
          const link = element('a', 'Open resource');
          link.href = url.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          card.append(link);
        }
      } catch (_error) {
        continue;
      }
      cards.push(card);
    }
    for (const item of sessions.docs) {
      const card = element('article', undefined, 'session-card');
      card.append(element('h3', item.data().title), element('p', `${dateText(item.data().startsAt)} – ${dateText(item.data().endsAt)}`, 'list-item-meta'));
      if (item.data().location) card.append(element('p', item.data().location));
      cards.push(card);
    }
    studentFeedList.replaceChildren(...(cards.length ? cards : [element('p', 'No class updates yet.', 'list-item-meta')]));
  } catch (error) {
    studentFeedList.replaceChildren(element('p', error.message || 'Could not load class updates.', 'list-item-meta'));
  }
}

async function loadStudentAssignments(classItem) {
  studentAssignmentList.replaceChildren(element('p', `Loading work for ${classItem.name}…`, 'list-item-meta'));
  try {
    const assignments = await getDocs(query(
      collection(db, 'assignments'),
      where('classId', '==', classItem.id),
      where('status', '==', 'published')
    ));
    studentAssignmentList.replaceChildren();
    if (assignments.empty) {
      studentAssignmentList.append(element('p', 'No published assignments yet.', 'list-item-meta'));
      return;
    }
    for (const assignmentDoc of assignments.docs) {
      await renderStudentAssignment(classItem, assignmentDoc);
    }
  } catch (error) {
    studentAssignmentList.replaceChildren(element('p', error.message || 'Could not load assignments.', 'list-item-meta'));
  }
}

async function renderStudentAssignment(classItem, assignmentDoc) {
  const assignment = assignmentDoc.data();
  const card = element('article', undefined, 'list-item');
  card.append(element('h3', assignment.title), element('p', assignment.description || '', 'list-item-meta'));
  card.append(element('p', `Due ${dateText(assignment.dueAt)} · ${assignment.points} points`, 'list-item-meta'));
  if (assignment.instructions) card.append(element('p', assignment.instructions));
  for (const href of Array.isArray(assignment.attachmentUrls) ? assignment.attachmentUrls : []) {
    try {
      const url = new URL(href);
      if (url.protocol !== 'https:') continue;
      const link = element('a', 'Open learning resource');
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      card.append(link);
    } catch (_error) {
      continue;
    }
  }

  const submissionRef = doc(db, 'assignments', assignmentDoc.id, 'submissions', currentUser.uid);
  const existing = await getDoc(submissionRef);
  const saved = existing.exists() ? existing.data() : null;
  if (saved && saved.gradedAt) {
    card.append(element('p', `Grade: ${saved.score} / ${assignment.points}`, 'list-item-meta'));
    if (saved.feedback) card.append(element('p', `Teacher feedback: ${saved.feedback}`));
  } else {
    const form = element('form', undefined, 'student-submission');
    const response = makeField('Your response', `response-${assignmentDoc.id}`, {
      type: 'textarea', rows: 4, maxLength: 10000, value: saved?.response || '', required: true
    });
    const resources = makeField('Optional HTTPS resource links, one per line', `resources-${assignmentDoc.id}`, {
      type: 'textarea', rows: 2, value: Array.isArray(saved?.attachmentUrls) ? saved.attachmentUrls.join('\n') : ''
    });
    const submit = element('button', saved ? 'Update submission' : 'Submit work', 'primary-button');
    submit.type = 'submit';
    form.append(response.label, response.field, resources.label, resources.field, submit);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;
      try {
        const data = {
          studentId: currentUser.uid,
          response: response.field.value.trim(),
          attachmentUrls: safeHttpsLinks(resources.field.value),
          submittedAt: serverTimestamp()
        };
        if (existing.exists()) await updateDoc(submissionRef, {
          response: data.response,
          attachmentUrls: data.attachmentUrls,
          submittedAt: data.submittedAt
        });
        else await setDoc(submissionRef, data);
        setStatus('Work submitted.', 'success');
        await loadStudentAssignments(classItem);
      } catch (error) {
        setStatus(error.message || 'Could not submit your work.', 'error');
        submit.disabled = false;
      }
    });
    card.append(form);
  }
  studentAssignmentList.append(card);
}

async function loadTeacherClasses() {
  teacherClassList.replaceChildren(element('p', 'Loading classes…', 'list-item-meta'));
  const [owned, shared] = await Promise.all([
    getDocs(query(collection(db, 'classes'), where('teacherId', '==', currentUser.uid))),
    getDocs(query(collection(db, 'classes'), where('coTeacherIds', 'array-contains', currentUser.uid)))
  ]);
  const combined = new Map();
  for (const snapshot of [...owned.docs, ...shared.docs]) {
    if (snapshot.data().archived !== true) combined.set(snapshot.id, { id: snapshot.id, ...snapshot.data() });
  }
  teacherClasses = [...combined.values()].sort((left, right) => left.name.localeCompare(right.name));
  teacherClassList.replaceChildren();
  if (!teacherClasses.length) {
    teacherClassList.append(element('p', 'Create a class to get started.', 'list-item-meta'));
    classDetails.hidden = true;
    classEmptyState.hidden = false;
    return;
  }
  for (const classItem of teacherClasses) {
    const select = makeButton(classItem.name, () => openTeacherClass(classItem.id), 'class-button secondary-button');
    select.setAttribute('aria-pressed', String(currentClass?.id === classItem.id));
    teacherClassList.append(select);
  }
  const selected = teacherClasses.find(item => item.id === currentClass?.id) || teacherClasses[0];
  await openTeacherClass(selected.id);
}

async function openTeacherClass(classId) {
  const snapshot = await getDoc(doc(db, 'classes', classId));
  if (!snapshot.exists() || snapshot.data().archived === true) throw new Error('This class is unavailable.');
  currentClass = { id: snapshot.id, ...snapshot.data() };
  byId('active-class-title').textContent = currentClass.name;
  byId('class-description').textContent = currentClass.description || 'No description.';
  byId('edit-class-name').value = currentClass.name;
  byId('edit-class-description').value = currentClass.description || '';
  byId('co-teacher-emails').value = '';
  const isLeadTeacher = currentClass.teacherId === currentUser.uid;
  byId('class-edit-form').hidden = !isLeadTeacher;
  byId('co-teacher-form').hidden = !isLeadTeacher;
  byId('archive-class').hidden = !isLeadTeacher;
  byId('delete-class').hidden = !isLeadTeacher;
  classEmptyState.hidden = true;
  classDetails.hidden = false;
  for (const button of teacherClassList.querySelectorAll('.class-button')) {
    button.setAttribute('aria-pressed', String(button.textContent === currentClass.name));
  }
  await renderTeacherTab(currentTab);
}

byId('class-create-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await call('createTeacherClass')({
      name: byId('new-class-name').value,
      description: byId('new-class-description').value
    });
    byId('new-class-name').value = '';
    byId('new-class-description').value = '';
    await loadTeacherClasses();
    setStatus(`Class created. Share join code ${result.data.joinCode} with students.`, 'success');
  } catch (error) {
    setStatus(error.message || 'Could not create the class.', 'error');
  } finally {
    button.disabled = false;
  }
});

byId('class-edit-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentClass) return;
  try {
    await updateDoc(doc(db, 'classes', currentClass.id), {
      name: byId('edit-class-name').value.trim(),
      description: byId('edit-class-description').value.trim(),
      updatedAt: serverTimestamp()
    });
    await loadTeacherClasses();
    setStatus('Class details saved.', 'success');
  } catch (error) {
    setStatus(error.message || 'Could not update class details.', 'error');
  }
});

byId('archive-class').addEventListener('click', async () => {
  if (!currentClass || !window.confirm(`Archive ${currentClass.name}? Students will lose access to its active class space.`)) return;
  try {
    await updateDoc(doc(db, 'classes', currentClass.id), { archived: true, updatedAt: serverTimestamp() });
    currentClass = null;
    await loadTeacherClasses();
    setStatus('Class archived. Existing grades and submissions are retained.', 'success');
  } catch (error) {
    setStatus(error.message || 'Could not archive the class.', 'error');
  }
});

byId('delete-class').addEventListener('click', async () => {
  if (!currentClass || !window.confirm(`Permanently delete ${currentClass.name}, all class posts/resources/sessions, assignments, and student submissions? This cannot be undone.`)) return;
  try {
    await call('deleteTeacherClass')({ classId: currentClass.id });
    currentClass = null;
    await loadTeacherClasses();
    setStatus('Class and its stored work were permanently deleted.', 'success');
  } catch (error) {
    setStatus(error.message || 'Could not delete the class.', 'error');
  }
});

byId('copy-code').addEventListener('click', async () => {
  if (!currentClass) return;
  try {
    const result = await call('getTeacherClassCode')({ classId: currentClass.id });
    await navigator.clipboard.writeText(result.data.joinCode);
    setStatus(`Copied class code ${result.data.joinCode}.`, 'success');
  } catch (error) {
    setStatus(error.message || 'Could not retrieve the class code.', 'error');
  }
});

byId('co-teacher-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentClass) return;
  const emails = byId('co-teacher-emails').value.split(',').map(value => value.trim()).filter(Boolean);
  try {
    await call('setTeacherCoTeachers')({ classId: currentClass.id, emails });
    setStatus('Co-teacher access updated.', 'success');
    await loadTeacherClasses();
  } catch (error) {
    setStatus(error.message || 'Could not update co-teachers.', 'error');
  }
});

for (const button of document.querySelectorAll('[data-tab]')) {
  button.addEventListener('click', async () => {
    currentTab = button.dataset.tab;
    for (const tab of document.querySelectorAll('[data-tab]')) {
      if (tab === button) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    await renderTeacherTab(currentTab);
  });
}

async function renderTeacherTab(tab) {
  if (!currentClass) return;
  workspaceContent.replaceChildren(element('p', 'Loading class data…', 'list-item-meta'));
  try {
    if (tab === 'overview') await renderOverview();
    else if (tab === 'assignments') await renderAssignments();
    else if (tab === 'roster') await renderRoster();
    else if (tab === 'announcements') await renderAnnouncements();
    else if (tab === 'materials') await renderMaterials();
    else if (tab === 'sessions') await renderSessions();
  } catch (error) {
    workspaceContent.replaceChildren(element('p', error.message || 'Could not load this class view.', 'list-item-meta'));
  }
}

async function loadClassAssignments() {
  const snapshot = await getDocs(query(
    collection(db, 'assignments'),
    where('classId', '==', currentClass.id),
    limit(100)
  ));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function loadRoster() {
  const snapshot = await getDocs(collection(db, 'classes', currentClass.id, 'members'));
  rosterById = new Map(snapshot.docs.map(item => [item.id, item.data()]));
  return [...rosterById.entries()].map(([id, data]) => ({ id, ...data }));
}

async function renderOverview() {
  const [roster, assignments, sessions] = await Promise.all([
    loadRoster(),
    loadClassAssignments(),
    getDocs(query(collection(db, 'classes', currentClass.id, 'sessions'), orderBy('startsAt', 'asc'), limit(5)))
  ]);
  let pending = 0;
  let pointsEarned = 0;
  let pointsAvailable = 0;
  const overdueStudents = new Set();
  const overdueByStudent = new Map();
  const performanceByStudent = new Map();
  const publishedAssignments = assignments.filter(item => item.status === 'published');
  for (const assignment of publishedAssignments) {
    const submissions = await getDocs(collection(db, 'assignments', assignment.id, 'submissions'));
    const submittedIds = new Set(submissions.docs.map(item => item.id));
    pending += submissions.docs.filter(item => !item.data().gradedAt).length;
    for (const submission of submissions.docs) {
      const grade = submission.data();
      if (grade.gradedAt && assignment.points > 0) {
        pointsEarned += grade.score;
        pointsAvailable += assignment.points;
        const performance = performanceByStudent.get(submission.id) || { earned: 0, possible: 0, graded: 0 };
        performance.earned += grade.score;
        performance.possible += assignment.points;
        performance.graded += 1;
        performanceByStudent.set(submission.id, performance);
      }
    }
    const dueAt = assignment.dueAt?.toDate?.();
    if (dueAt && dueAt < new Date()) {
      for (const student of roster) {
        if (!submittedIds.has(student.id)) {
          overdueStudents.add(student.id);
          const missing = overdueByStudent.get(student.id) || [];
          missing.push(assignment.title);
          overdueByStudent.set(student.id, missing);
        }
      }
    }
  }
  const upcoming = sessions.docs.filter(item => item.data().startsAt.toDate() >= new Date());
  const metrics = [
    ['Students', roster.length],
    ['Published assignments', publishedAssignments.length],
    ['Awaiting grade', pending],
    ['Class average', pointsAvailable ? `${Math.round((pointsEarned / pointsAvailable) * 100)}%` : '—'],
    ['At-risk learners', roster.filter(student => overdueStudents.has(student.id)
      || ((performanceByStudent.get(student.id)?.graded || 0) > 0
        && performanceByStudent.get(student.id).earned / performanceByStudent.get(student.id).possible < 0.6)).length],
    ['Upcoming sessions', upcoming.length]
  ];
  byId('teacher-metrics').replaceChildren(...metrics.map(([label, value]) => {
    const card = element('div', undefined, 'metric');
    card.append(element('strong', String(value)), element('span', label));
    return card;
  }));
  const recent = element('section');
  recent.append(element('h3', 'Recent announcements'));
  const announcements = await getDocs(query(collection(db, 'classes', currentClass.id, 'announcements'), orderBy('createdAt', 'desc'), limit(3)));
  if (announcements.empty) recent.append(element('p', 'No announcements yet.', 'list-item-meta'));
  for (const item of announcements.docs) {
    const paragraph = element('p', item.data().body, 'announcement-card');
    recent.append(paragraph);
  }
  const atRiskSection = element('section');
  atRiskSection.append(element('h3', 'Learners to check in with'));
  const atRisk = roster.filter(student => overdueStudents.has(student.id)
    || ((performanceByStudent.get(student.id)?.graded || 0) > 0
      && performanceByStudent.get(student.id).earned / performanceByStudent.get(student.id).possible < 0.6));
  if (!atRisk.length) {
    atRiskSection.append(element('p', 'No overdue or low-scoring work to review.', 'list-item-meta'));
  } else {
    for (const student of atRisk) {
      const performance = performanceByStudent.get(student.id);
      const reasons = [];
      if (overdueStudents.has(student.id)) reasons.push(`${overdueByStudent.get(student.id).length} overdue assignment(s)`);
      if (performance?.graded) reasons.push(`graded average ${Math.round((performance.earned / performance.possible) * 100)}%`);
      atRiskSection.append(element('p', `${student.displayName || 'Student'} · ${reasons.join(' · ')}`, 'list-item-meta'));
    }
  }
  workspaceContent.replaceChildren(recent, atRiskSection);
}

async function renderRoster() {
  const roster = await loadRoster();
  const heading = element('h3', `${roster.length} students`);
  const list = element('div', undefined, 'stack-list');
  for (const student of roster) {
    const card = element('article', undefined, 'list-item');
    card.append(element('strong', student.displayName || 'Student'));
    if (student.email) card.append(element('p', student.email, 'list-item-meta'));
    const remove = makeButton('Remove from class', async () => {
      if (!window.confirm(`Remove ${student.displayName || 'this student'} from ${currentClass.name}?`)) return;
      try {
        await call('removeTeacherStudent')({ classId: currentClass.id, studentId: student.id });
        setStatus('Student removed. Their previous work remains in the gradebook.', 'success');
        await renderTeacherTab('roster');
      } catch (error) {
        setStatus(error.message || 'Could not remove this student.', 'error');
      }
    }, 'danger-button');
    card.append(remove);
    list.append(card);
  }
  if (!roster.length) list.append(element('p', 'Students who join with the class code will appear here.', 'list-item-meta'));
  workspaceContent.replaceChildren(heading, list);
}

async function renderAssignments() {
  const form = element('form', undefined, 'form-section');
  form.append(element('h3', 'Create assignment'));
  const title = makeField('Title', 'assignment-title', { maxLength: 160, required: true });
  const description = makeField('Description', 'assignment-description', { type: 'textarea', rows: 2, maxLength: 2000 });
  const instructions = makeField('Instructions', 'assignment-instructions', { type: 'textarea', rows: 4, maxLength: 5000, required: true });
  const due = makeField('Due date', 'assignment-due', { type: 'datetime-local' });
  const points = makeField('Points', 'assignment-points', { type: 'number', value: '100', required: true });
  points.field.min = '0';
  points.field.max = '1000';
  points.field.step = '1';
  const statusLabel = element('label', 'Publication status');
  const statusSelect = document.createElement('select');
  statusSelect.id = 'assignment-status';
  statusSelect.name = 'status';
  statusSelect.add(new Option('Draft', 'draft'));
  statusSelect.add(new Option('Published', 'published'));
  statusLabel.htmlFor = statusSelect.id;
  const links = makeField('Optional HTTPS resource links, one per line', 'assignment-links', { type: 'textarea', rows: 2 });
  const submit = element('button', 'Save assignment', 'primary-button');
  submit.type = 'submit';
  form.append(title.label, title.field, description.label, description.field, instructions.label, instructions.field,
    due.label, due.field, points.label, points.field, statusLabel, statusSelect, links.label, links.field, submit);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const dueAt = due.field.value ? Timestamp.fromDate(new Date(due.field.value)) : null;
      await addDoc(collection(db, 'assignments'), {
        classId: currentClass.id,
        teacherId: currentUser.uid,
        title: title.field.value.trim(),
        description: description.field.value.trim(),
        instructions: instructions.field.value.trim(),
        dueAt,
        points: Number(points.field.value),
        status: statusSelect.value,
        attachmentUrls: safeHttpsLinks(links.field.value),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setStatus('Assignment saved.', 'success');
      await renderAssignments();
    } catch (error) {
      setStatus(error.message || 'Could not save the assignment.', 'error');
      submit.disabled = false;
    }
  });

  const assignmentList = element('div', undefined, 'stack-list');
  const exportButton = makeButton('Export gradebook CSV', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const roster = await loadRoster();
      const rows = [['Assignment', 'Student', 'Email', 'Score', 'Points', 'Feedback', 'Submitted', 'Graded']];
      const assignments = await loadClassAssignments();
      for (const assignment of assignments) {
        const submissions = await getDocs(collection(db, 'assignments', assignment.id, 'submissions'));
        for (const submissionDoc of submissions.docs) {
          const submission = submissionDoc.data();
          const student = rosterById.get(submissionDoc.id) || {};
          rows.push([
            assignment.title,
            student.displayName || submissionDoc.id,
            student.email || '',
            submission.score ?? '',
            assignment.points,
            submission.feedback || '',
            dateText(submission.submittedAt),
            dateText(submission.gradedAt)
          ]);
        }
      }
      const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = element('a', 'Download gradebook CSV');
      link.href = url;
      link.download = `${currentClass.name.replace(/[^a-z0-9_-]+/gi, '-')}-gradebook.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setStatus(error.message || 'Could not export the gradebook.', 'error');
    } finally {
      button.disabled = false;
    }
  }, 'secondary-button');
  const assignments = await loadClassAssignments();
  assignments.sort((left, right) => (right.createdAt?.toMillis?.() || 0) - (left.createdAt?.toMillis?.() || 0));
  if (!assignments.length) assignmentList.append(element('p', 'No assignments yet.', 'list-item-meta'));
  const roster = await loadRoster();
  for (const assignment of assignments) {
    const card = element('article', undefined, 'assignment-card');
    card.append(element('h3', assignment.title));
    card.append(element('p', `${assignment.status === 'published' ? 'Published' : 'Draft'} · ${assignment.points} points · Due ${dateText(assignment.dueAt)}`, 'list-item-meta'));
    if (assignment.description) card.append(element('p', assignment.description));
    const submissions = await getDocs(collection(db, 'assignments', assignment.id, 'submissions'));
    card.append(element('p', `${submissions.size} submissions`, 'list-item-meta'));
    const graded = submissions.docs.filter(item => item.data().gradedAt && assignment.points > 0);
    if (graded.length) {
      const average = graded.reduce((sum, item) => sum + item.data().score, 0) / (graded.length * assignment.points);
      card.append(element('p', `Average score: ${Math.round(average * 100)}% · ${graded.length} graded`, 'list-item-meta'));
    }
    for (const submissionDoc of submissions.docs) {
      const submission = submissionDoc.data();
      const row = element('div', undefined, 'grade-row');
      const student = rosterById.get(submissionDoc.id);
      const name = element('div', student?.displayName || submissionDoc.id);
      const work = element('div', submission.response || 'No response text.');
      const score = makeField(`Score, max ${assignment.points}`, `score-${submissionDoc.id}`, { type: 'number', value: submission.score ?? '', required: true });
      score.field.min = '0';
      score.field.max = String(assignment.points);
      score.field.step = '1';
      const feedback = makeField('Feedback', `feedback-${submissionDoc.id}`, { type: 'textarea', rows: 2, maxLength: 2000, value: submission.feedback || '' });
      const saveGrade = makeButton(submission.gradedAt ? 'Update grade' : 'Save grade', async () => {
        saveGrade.disabled = true;
        try {
          const numericScore = Number(score.field.value);
          if (!Number.isInteger(numericScore) || numericScore < 0 || numericScore > assignment.points) {
            throw new Error(`Score must be between 0 and ${assignment.points}.`);
          }
          await updateDoc(doc(db, 'assignments', assignment.id, 'submissions', submissionDoc.id), {
            score: numericScore,
            feedback: feedback.field.value.trim(),
            gradedBy: currentUser.uid,
            gradedAt: serverTimestamp()
          });
          setStatus('Grade saved.', 'success');
          await renderAssignments();
        } catch (error) {
          setStatus(error.message || 'Could not save the grade.', 'error');
          saveGrade.disabled = false;
        }
      }, 'secondary-button');
      row.append(name, work, score.label, feedback.label, score.field, feedback.field, saveGrade);
      card.append(row);
    }
    const editor = element('details', undefined, 'assignment-editor');
    editor.append(element('summary', 'Edit assignment'));
    const editForm = element('form', undefined, 'form-section');
    const editTitle = makeField('Title', `edit-title-${assignment.id}`, { maxLength: 160, required: true, value: assignment.title });
    const editDescription = makeField('Description', `edit-description-${assignment.id}`, { type: 'textarea', rows: 2, maxLength: 2000, value: assignment.description || '' });
    const editInstructions = makeField('Instructions', `edit-instructions-${assignment.id}`, { type: 'textarea', rows: 3, maxLength: 5000, required: true, value: assignment.instructions || '' });
    const editDue = makeField('Due date', `edit-due-${assignment.id}`, { type: 'datetime-local', value: datetimeLocalValue(assignment.dueAt) });
    const editPoints = makeField('Points', `edit-points-${assignment.id}`, { type: 'number', value: String(assignment.points), required: true });
    editPoints.field.min = '0';
    editPoints.field.max = '1000';
    editPoints.field.step = '1';
    const editStatusLabel = element('label', 'Publication status');
    const editStatus = document.createElement('select');
    editStatus.id = `edit-status-${assignment.id}`;
    editStatus.add(new Option('Draft', 'draft'));
    editStatus.add(new Option('Published', 'published'));
    editStatus.value = assignment.status;
    editStatusLabel.htmlFor = editStatus.id;
    const editLinks = makeField('Optional HTTPS resource links, one per line', `edit-links-${assignment.id}`, {
      type: 'textarea', rows: 2, value: Array.isArray(assignment.attachmentUrls) ? assignment.attachmentUrls.join('\n') : ''
    });
    const saveEdit = element('button', 'Save changes', 'primary-button');
    saveEdit.type = 'submit';
    editForm.append(editTitle.label, editTitle.field, editDescription.label, editDescription.field,
      editInstructions.label, editInstructions.field, editDue.label, editDue.field,
      editPoints.label, editPoints.field, editStatusLabel, editStatus,
      editLinks.label, editLinks.field, saveEdit);
    editForm.addEventListener('submit', async event => {
      event.preventDefault();
      saveEdit.disabled = true;
      try {
        const dueAt = editDue.field.value ? Timestamp.fromDate(new Date(editDue.field.value)) : null;
        await updateDoc(doc(db, 'assignments', assignment.id), {
          title: editTitle.field.value.trim(),
          description: editDescription.field.value.trim(),
          instructions: editInstructions.field.value.trim(),
          dueAt,
          points: Number(editPoints.field.value),
          status: editStatus.value,
          attachmentUrls: safeHttpsLinks(editLinks.field.value),
          updatedAt: serverTimestamp()
        });
        setStatus('Assignment updated.', 'success');
        await renderAssignments();
      } catch (error) {
        setStatus(error.message || 'Could not update assignment.', 'error');
        saveEdit.disabled = false;
      }
    });
    editor.append(editForm);
    editor.append(makeButton('Delete assignment and student submissions', async event => {
      if (!window.confirm(`Delete ${assignment.title} and all student submissions? This cannot be undone.`)) return;
      const deleteButton = event.currentTarget;
      deleteButton.disabled = true;
      try {
        await call('deleteTeacherAssignment')({ assignmentId: assignment.id });
        setStatus('Assignment and submissions deleted.', 'success');
        await renderAssignments();
      } catch (error) {
        setStatus(error.message || 'Could not delete assignment.', 'error');
        deleteButton.disabled = false;
      }
    }, 'danger-button'));
    card.append(editor);
    assignmentList.append(card);
  }
  workspaceContent.replaceChildren(form, element('h3', 'Assignments and gradebook'), exportButton, assignmentList);
}

async function renderAnnouncements() {
  const form = element('form', undefined, 'form-section');
  form.append(element('h3', 'Post an announcement'));
  const body = makeField('Message', 'announcement-body', { type: 'textarea', rows: 4, maxLength: 2000, required: true });
  const submit = element('button', 'Post announcement', 'primary-button');
  submit.type = 'submit';
  form.append(body.label, body.field, submit);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    try {
      await addDoc(collection(db, 'classes', currentClass.id, 'announcements'), {
        authorId: currentUser.uid,
        body: body.field.value.trim(),
        createdAt: serverTimestamp()
      });
      setStatus('Announcement posted.', 'success');
      await renderAnnouncements();
    } catch (error) {
      setStatus(error.message || 'Could not post the announcement.', 'error');
      submit.disabled = false;
    }
  });
  const snapshot = await getDocs(query(collection(db, 'classes', currentClass.id, 'announcements'), orderBy('createdAt', 'desc'), limit(50)));
  const list = element('div', undefined, 'stack-list');
  for (const item of snapshot.docs) {
    const card = element('article', undefined, 'announcement-card');
    card.append(element('p', item.data().body), element('p', dateText(item.data().createdAt), 'list-item-meta'));
    if (item.data().authorId === currentUser.uid) card.append(makeButton('Delete', async () => {
      try { await deleteDoc(item.ref); await renderAnnouncements(); }
      catch (error) { setStatus(error.message || 'Could not delete announcement.', 'error'); }
    }, 'danger-button'));
    list.append(card);
  }
  workspaceContent.replaceChildren(form, list);
}

async function renderMaterials() {
  const form = element('form', undefined, 'form-section');
  form.append(element('h3', 'Add a learning resource'));
  const title = makeField('Title', 'material-title', { maxLength: 120, required: true });
  const url = makeField('HTTPS resource URL', 'material-url', { type: 'url', required: true, maxLength: 2048 });
  const kindLabel = element('label', 'Resource type');
  const kind = document.createElement('select');
  kind.id = 'material-kind';
  for (const value of ['reading', 'activity', 'resource']) kind.add(new Option(value[0].toUpperCase() + value.slice(1), value));
  kindLabel.htmlFor = kind.id;
  const submit = element('button', 'Add resource', 'primary-button');
  submit.type = 'submit';
  form.append(title.label, title.field, url.label, url.field, kindLabel, kind, submit);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const parsed = new URL(url.field.value);
      if (parsed.protocol !== 'https:') throw new Error('Resource links must use HTTPS.');
      await addDoc(collection(db, 'classes', currentClass.id, 'materials'), {
        title: title.field.value.trim(), url: parsed.href, kind: kind.value,
        createdBy: currentUser.uid, createdAt: serverTimestamp()
      });
      setStatus('Resource added.', 'success');
      await renderMaterials();
    } catch (error) {
      setStatus(error.message || 'Could not add the resource.', 'error');
      submit.disabled = false;
    }
  });
  const snapshot = await getDocs(query(collection(db, 'classes', currentClass.id, 'materials'), orderBy('createdAt', 'desc'), limit(100)));
  const list = element('div', undefined, 'stack-list');
  for (const item of snapshot.docs) {
    const card = element('article', undefined, 'material-card');
    card.append(element('h3', item.data().title), element('p', item.data().kind, 'list-item-meta'));
    const link = element('a', 'Open resource');
    link.href = item.data().url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    card.append(link);
    if (item.data().createdBy === currentUser.uid) card.append(makeButton('Remove', async () => {
      try { await deleteDoc(item.ref); await renderMaterials(); }
      catch (error) { setStatus(error.message || 'Could not remove the resource.', 'error'); }
    }, 'danger-button'));
    list.append(card);
  }
  workspaceContent.replaceChildren(form, list);
}

async function renderSessions() {
  const form = element('form', undefined, 'form-section');
  form.append(element('h3', 'Schedule a session'));
  const title = makeField('Session title', 'session-title', { maxLength: 120, required: true });
  const starts = makeField('Starts', 'session-start', { type: 'datetime-local', required: true });
  const ends = makeField('Ends', 'session-end', { type: 'datetime-local', required: true });
  const location = makeField('Location or meeting link', 'session-location', { maxLength: 300 });
  const submit = element('button', 'Schedule session', 'primary-button');
  submit.type = 'submit';
  form.append(title.label, title.field, starts.label, starts.field, ends.label, ends.field, location.label, location.field, submit);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const startDate = new Date(starts.field.value);
      const endDate = new Date(ends.field.value);
      if (!(endDate > startDate)) throw new Error('End time must be after start time.');
      await addDoc(collection(db, 'classes', currentClass.id, 'sessions'), {
        title: title.field.value.trim(),
        startsAt: Timestamp.fromDate(startDate),
        endsAt: Timestamp.fromDate(endDate),
        location: location.field.value.trim(),
        createdBy: currentUser.uid,
        createdAt: serverTimestamp()
      });
      setStatus('Session scheduled.', 'success');
      await renderSessions();
    } catch (error) {
      setStatus(error.message || 'Could not schedule the session.', 'error');
      submit.disabled = false;
    }
  });
  const snapshot = await getDocs(query(collection(db, 'classes', currentClass.id, 'sessions'), orderBy('startsAt', 'asc'), limit(50)));
  const list = element('div', undefined, 'stack-list');
  for (const item of snapshot.docs) {
    const card = element('article', undefined, 'session-card');
    card.append(element('h3', item.data().title), element('p', `${dateText(item.data().startsAt)} – ${dateText(item.data().endsAt)}`, 'list-item-meta'));
    if (item.data().location) card.append(element('p', item.data().location));
    if (item.data().createdBy === currentUser.uid) card.append(makeButton('Cancel session', async () => {
      try { await deleteDoc(item.ref); await renderSessions(); }
      catch (error) { setStatus(error.message || 'Could not cancel the session.', 'error'); }
    }, 'danger-button'));
    list.append(card);
  }
  workspaceContent.replaceChildren(form, list);
}

async function renderAdminReview() {
  const section = byId('admin-review');
  section.hidden = false;
  const list = byId('application-list');
  list.replaceChildren(element('p', 'Loading pending applications…', 'list-item-meta'));
  try {
    const applications = await getDocs(query(collection(db, 'teacherApplications'), where('status', '==', 'pending'), limit(100)));
    list.replaceChildren();
    if (applications.empty) list.append(element('p', 'No pending applications.', 'list-item-meta'));
    for (const item of applications.docs) {
      const data = item.data();
      const card = element('article', undefined, 'list-item');
      card.append(element('h3', data.displayName), element('p', data.email, 'list-item-meta'));
      if (data.school) card.append(element('p', data.school));
      if (data.experience) card.append(element('p', data.experience));
      const actions = element('div', undefined, 'list-item-actions');
      for (const [label, decision, style] of [['Approve', 'approve', 'primary-button'], ['Reject', 'reject', 'danger-button']]) {
        actions.append(makeButton(label, async event => {
          const decisionButton = event.currentTarget;
          decisionButton.disabled = true;
          try {
            await call('reviewTeacherApplication')({ userId: item.id, decision });
            await renderAdminReview();
            setStatus(`Application ${decision}d.`, 'success');
          } catch (error) {
            setStatus(error.message || 'Could not review this application.', 'error');
            decisionButton.disabled = false;
          }
        }, style));
      }
      card.append(actions);
      list.append(card);
    }
  } catch (error) {
    list.replaceChildren(element('p', error.message || 'Could not load applications.', 'list-item-meta'));
  }
}

async function initializeUser(user) {
  currentUser = user;
  byId('sign-out').hidden = false;
  byId('sign-out').addEventListener('click', () => auth.signOut());
  if (!user) {
    const destination = new URL('index.html', window.location.href);
    destination.searchParams.set('continue', 'teacher.html');
    window.location.replace(destination.href);
    return;
  }
  try {
    const token = await user.getIdTokenResult();
    const isAdmin = token.claims.admin === true || user.email === 'cajm23331@gmail.com' || user.uid === '2nuzhsYAXiaMhm4RhRWksNLIBcJ3';
    const isTeacher = token.claims.role === 'teacher';
    if (isTeacher || isAdmin) {
      teacherPanel.hidden = false;
      accessPanel.hidden = !isAdmin;
      if (isAdmin) {
        byId('access-title').hidden = true;
        accessPanel.querySelector(':scope > p:not(.eyebrow)').hidden = true;
        accessPanel.querySelector('.eyebrow').hidden = true;
      }
      byId('application-form').hidden = true;
      byId('join-class-form').hidden = true;
      byId('student-classes').hidden = true;
      byId('student-work').hidden = true;
      byId('student-class-feed').hidden = true;
      await loadTeacherClasses();
      if (isAdmin) await renderAdminReview();
      setStatus(`Signed in as ${user.email || 'HouseLearning teacher'}.`);
      return;
    }
    showStudentApplication();
    byId('teacher-name').value = user.displayName || '';
    await Promise.all([loadApplication(), loadStudentClasses()]);
    setStatus(`Signed in as ${user.email || 'student'}.`);
  } catch (error) {
    setStatus(error.message || 'Could not verify account permissions.', 'error');
    accessPanel.hidden = false;
    teacherPanel.hidden = true;
  }
}

onAuthStateChanged(auth, user => { void initializeUser(user); });