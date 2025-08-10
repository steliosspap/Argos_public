const bcrypt = require('bcryptjs');

async function testPassword() {
  const password = 'TestPersonal123!';
  const hash = '$2b$10$yNj3ahUBal8JEZPgHkRcxOvdQeFIkbjZIAteo8gxKXe6U/eNRmBMy';
  
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