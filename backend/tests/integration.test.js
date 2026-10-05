// NOTE: this suite runs in-process against the real app (via supertest) but
// still talks to whatever Postgres database is configured in the environment
// (DB_HOST/DB_NAME/etc, or DATABASE_URL) — it writes real rows with
// Date.now()-suffixed emails to avoid collisions, but does not clean up
// after itself beyond deleting the families it creates (which cascades to
// their persons/relationships/memories). Do not point this at a shared or
// production database; CI runs it against a disposable Postgres container.
const request = require('supertest');
const app = require('../server');
const pool = require('../config/db');
const mailer = require('../utils/mailer');

describe('Family Tree Backend Integration Tests', () => {
  let token = '';
  let familyId = '';
  let personId = '';
  let person2Id = '';
  const testEmail = `test_${Date.now()}@example.com`;

  it('1. should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: testEmail,
        password: 'password123'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message');
  });

  it('2. should login the user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'password123'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    token = res.body.token;
  });

  it('3. should create a family', async () => {
    const res = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${token}`)
      .send({
        family_name: 'Test Family'
      });

    // familyController wraps responses as { success, data: {...} }
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('data.id');
    familyId = res.body.data.id;
  });

  it('4. should add a family member', async () => {
    const res = await request(app)
      .post('/api/persons')
      .set('Authorization', `Bearer ${token}`)
      .send({
        first_name: 'John',
        last_name: 'Doe',
        family_id: familyId
      });

    // personController returns the raw row, unwrapped
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    personId = res.body.id;
  });

  it('5. should create a relationship between two distinct persons', async () => {
    const secondPerson = await request(app)
      .post('/api/persons')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Jane', last_name: 'Doe', family_id: familyId });
    person2Id = secondPerson.body.id;

    const res = await request(app)
      .post('/api/relationships')
      .set('Authorization', `Bearer ${token}`)
      .send({
        person1_id: personId,
        person2_id: person2Id,
        relationship_type: 'sibling'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.relationship_type).toEqual('sibling');
  });

  describe('Collaborators', () => {
    let collaboratorToken = '';
    let collaboratorUserId = '';
    const collabEmail = `collab_${Date.now()}@example.com`;

    it('6. should register and log in a second user', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'Collaborator', email: collabEmail, password: 'password123' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: collabEmail, password: 'password123' });

      collaboratorToken = res.body.token;
      expect(collaboratorToken).toBeTruthy();
    });

    it('7. owner invites the second user as a viewer', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/collaborators`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: collabEmail, role: 'viewer' });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.role).toEqual('viewer');
      collaboratorUserId = res.body.data.user_id;
    });

    it('8. re-inviting the same email is rejected as a conflict', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/collaborators`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: collabEmail, role: 'viewer' });

      expect(res.statusCode).toEqual(409);
    });

    it('9. inviting an unregistered email is rejected with a clear message', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/collaborators`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: `nobody_${Date.now()}@example.com`, role: 'viewer' });

      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toMatch(/No Kutumb account found/);
    });

    it('10. the collaborator sees the family on their own family list with role viewer', async () => {
      const res = await request(app)
        .get('/api/families')
        .set('Authorization', `Bearer ${collaboratorToken}`);

      const shared = res.body.data.find(f => f.id === familyId);
      expect(shared).toBeDefined();
      expect(shared.my_role).toEqual('viewer');
    });

    it('11. a viewer cannot create a person (write denied)', async () => {
      const res = await request(app)
        .post('/api/persons')
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ first_name: 'Blocked', last_name: 'Viewer', family_id: familyId });

      expect(res.statusCode).toEqual(404);
    });

    it('12. after promotion to editor, the collaborator can create a person', async () => {
      const promote = await request(app)
        .put(`/api/families/${familyId}/collaborators/${collaboratorUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'editor' });
      expect(promote.statusCode).toEqual(200);

      const res = await request(app)
        .post('/api/persons')
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ first_name: 'Allowed', last_name: 'Editor', family_id: familyId });

      expect(res.statusCode).toEqual(201);
    });

    it('13. the owner can remove the collaborator', async () => {
      const res = await request(app)
        .delete(`/api/families/${familyId}/collaborators/${collaboratorUserId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
    });

    it('14. the former collaborator no longer sees the family', async () => {
      const res = await request(app)
        .get('/api/families')
        .set('Authorization', `Bearer ${collaboratorToken}`);

      const shared = res.body.data.find(f => f.id === familyId);
      expect(shared).toBeUndefined();
    });
  });

  describe('Memories and Legacy Messages', () => {
    let memoryId = '';
    let strangerToken = '';
    const strangerEmail = `stranger_${Date.now()}@example.com`;

    it('15. should register an unrelated stranger user', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'Stranger', email: strangerEmail, password: 'password123' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: strangerEmail, password: 'password123' });

      strangerToken = res.body.token;
      expect(strangerToken).toBeTruthy();
    });

    it('16. the owner can create a memory for the family', async () => {
      const res = await request(app)
        .post('/api/memories')
        .set('Authorization', `Bearer ${token}`)
        .send({ family_id: familyId, person_id: personId, title: 'First memory' });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      memoryId = res.body.id;
    });

    it('17. the owner can fetch memories by family and by person', async () => {
      const byFamily = await request(app)
        .get(`/api/memories/family/${familyId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(byFamily.statusCode).toEqual(200);
      expect(byFamily.body.some(m => m.id === memoryId)).toBe(true);

      const byPerson = await request(app)
        .get(`/api/memories/person/${personId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(byPerson.statusCode).toEqual(200);
      expect(byPerson.body.some(m => m.id === memoryId)).toBe(true);
    });

    it('18. a stranger cannot see or create memories for a family they have no access to', async () => {
      const list = await request(app)
        .get(`/api/memories/family/${familyId}`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(list.statusCode).toEqual(200);
      expect(list.body.some(m => m.id === memoryId)).toBe(false);

      const create = await request(app)
        .post('/api/memories')
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ family_id: familyId, person_id: personId, title: 'Should not be created' });
      expect(create.statusCode).toEqual(404);
    });

    it('19. the owner can delete the memory', async () => {
      const res = await request(app)
        .delete(`/api/memories/${memoryId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toEqual(200);
    });

    it('20. legacy message routes reject unauthenticated requests', async () => {
      const res = await request(app).get(`/api/legacy/${personId}`);
      expect(res.statusCode).toEqual(401);
    });

    it('21. the owner can create and fetch a legacy message', async () => {
      const create = await request(app)
        .post(`/api/legacy/${personId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'A Tribute', message: 'We love you', emotion_tag: 'love' });
      expect(create.statusCode).toEqual(201);
      expect(create.body).toHaveProperty('id');

      const list = await request(app)
        .get(`/api/legacy/${personId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(list.statusCode).toEqual(200);
      expect(list.body.some(m => m.id === create.body.id)).toBe(true);
    });

    it('22. a stranger cannot create legacy messages for a person outside their access', async () => {
      const res = await request(app)
        .post(`/api/legacy/${personId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ title: 'Intruder', message: 'Should not be allowed' });
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('Password Reset', () => {
    const resetEmail = `reset_${Date.now()}@example.com`;
    const originalPassword = 'password123';
    const newPassword = 'newPassword456';
    let resetToken = '';

    it('23. should register a dedicated user for the reset flow', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Reset Test', email: resetEmail, password: originalPassword });
      expect(res.statusCode).toEqual(201);
    });

    it('24. requesting a reset for an unregistered email returns the same generic message (no enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: `nobody_${Date.now()}@example.com` });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toMatch(/If that email is registered/);
    });

    it('25. requesting a reset for a registered email sends (in test mode, records) a token', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: resetEmail });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toMatch(/If that email is registered/);

      const lastEmail = mailer._testGetLastEmail();
      expect(lastEmail.to).toEqual(resetEmail);
      const url = new URL(lastEmail.resetUrl);
      resetToken = url.searchParams.get('token');
      expect(resetToken).toBeTruthy();
    });

    it('26. resetting with a bogus token is rejected', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'not-a-real-token', password: newPassword });

      expect(res.statusCode).toEqual(400);
    });

    it('27. resetting with the real token succeeds', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: newPassword });

      expect(res.statusCode).toEqual(200);
    });

    it('28. the old password no longer works', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: resetEmail, password: originalPassword });

      expect(res.statusCode).toEqual(401);
    });

    it('29. the new password works', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: resetEmail, password: newPassword });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
    });

    it('30. the same reset token cannot be reused', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: 'yetAnotherPassword789' });

      expect(res.statusCode).toEqual(400);
    });
  });

  afterAll(async () => {
    if (familyId && token) {
      await request(app).delete(`/api/families/${familyId}`).set('Authorization', `Bearer ${token}`);
    }
    // The family delete above only removes the owning user's data (families
    // cascade to persons/relationships/memories) — it never removed the
    // *users* this suite registers (testEmail/collabEmail/strangerEmail/
    // resetEmail/nobody_*), so every run against a real (non-disposable) DB
    // left orphaned accounts behind indefinitely. Sweep all of this suite's
    // known email patterns here regardless of which describe block created them.
    await pool.query(
      `DELETE FROM users WHERE email LIKE 'test_%@example.com'
         OR email LIKE 'collab_%@example.com'
         OR email LIKE 'stranger_%@example.com'
         OR email LIKE 'reset_%@example.com'
         OR email LIKE 'nobody_%@example.com';`
    );
    // Close all pooled connections explicitly so Jest can exit cleanly
    // instead of waiting on pg's idle-connection timeout.
    await pool.end();
  });
});
