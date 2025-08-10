require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');

async function testPassword() {
  // Test the password we created for test_personal
  const password = 'TestPersonal123!';
  const hash = '$2b$10$xJQ7WBCbnOJeJp8oRvuFYOBOe9Bj9f6m0DM4UH6n.7HGBSEfHk7Lu';
  
  console.log('Testing password verification...');
  console.log('Password:', password);
  console.log('Hash:', hash);
  
  try {
    const match = await bcrypt.compare(password, hash);
    console.log('Match result:', match);
  } catch (err) {
    console.error('Error:', err);
  }
}

testPassword();