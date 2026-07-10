import { verifyPassword } from 'better-auth/crypto'

async function main() {
  const password = 'password123'
  const hash = 'c220add1e40fe70a86711538aeeb5c90:4e41bf4577408ca8117cbc193f5296ca7e1247ac8f0b5aaed20a086628fd46aeeed1bfbb7f41ca734e5d61f99dd4f57bf4325e393919e73e4c39662aeefa2906'
  const match = await verifyPassword(password, hash)
  console.log('Password match:', match)
}

main().catch(console.error)