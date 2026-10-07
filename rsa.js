// rsa.js
// Utility functions for RSA implemented with BigInt

// GCD (Greatest Common Divisor)
function gcd(a, b) {
    while (b !== 0n) {
        let temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

// Extended Euclidean Algorithm to find modular inverse
function modInverse(a, m) {
    let m0 = m;
    let y = 0n, x = 1n;
    if (m === 1n) return 0n;

    while (a > 1n) {
        let q = a / m;
        let t = m;

        m = a % m;
        a = t;
        t = y;

        y = x - q * y;
        x = t;
    }

    if (x < 0n) x += m0;
    return x;
}

// Modular exponentiation (base^exp % mod)
function modExp(base, exp, mod) {
    let res = 1n;
    base = base % mod;
    while (exp > 0n) {
        if (exp % 2n === 1n) res = (res * base) % mod;
        exp = exp / 2n;
        base = (base * base) % mod;
    }
    return res;
}

// Check if prime (simple trial division for small primes)
function isPrime(num) {
    if (num <= 1n) return false;
    if (num <= 3n) return true;
    if (num % 2n === 0n || num % 3n === 0n) return false;
    for (let i = 5n; i * i <= num; i += 6n) {
        if (num % i === 0n || num % (i + 2n) === 0n) return false;
    }
    return true;
}

// Generate random prime in range [min, max]
function generatePrime(min, max) {
    let prime = 0n;
    while (true) {
        let rand = BigInt(Math.floor(Math.random() * (max - min + 1)) + min);
        if (isPrime(rand)) {
            prime = rand;
            break;
        }
    }
    return prime;
}

function generateKeys(p, q) {
    p = BigInt(p);
    q = BigInt(q);
    const n = p * q;
    const phi = (p - 1n) * (q - 1n);

    // Choose e such that 1 < e < phi and gcd(e, phi) == 1
    let e = 65537n; // common choice
    if (e >= phi || gcd(e, phi) !== 1n) {
        e = 3n;
        while (e < phi) {
            if (gcd(e, phi) === 1n) break;
            e += 2n;
        }
    }

    const d = modInverse(e, phi);

    return {
        p: p.toString(),
        q: q.toString(),
        n: n.toString(),
        phi: phi.toString(),
        e: e.toString(),
        d: d.toString(),
        publicKey: { e: e.toString(), n: n.toString() },
        privateKey: { d: d.toString(), n: n.toString() }
    };
}

// Encrypt a string
// We'll encrypt character by character (its char code) to make the explanation clear for students
function encryptMessage(message, eStr, nStr) {
    const e = BigInt(eStr);
    const n = BigInt(nStr);
    let ciphertext = [];
    let log = [];
    for (let i = 0; i < message.length; i++) {
        let m = BigInt(message.charCodeAt(i));
        let c = modExp(m, e, n);
        ciphertext.push(c.toString());
        log.push(`'${message[i]}' (ASCII: ${m}) -> ${m}^${e} mod ${n} = ${c}`);
    }
    return {
        ciphertext: ciphertext.join(','),
        log: log
    };
}

// Decrypt a string
function decryptMessage(cipherStr, dStr, nStr) {
    const d = BigInt(dStr);
    const n = BigInt(nStr);
    let cipherArray = cipherStr.split(',').filter(x => x.trim() !== '');
    let plaintext = "";
    let log = [];
    for (let i = 0; i < cipherArray.length; i++) {
        let c = BigInt(cipherArray[i]);
        let m = modExp(c, d, n);
        let char = String.fromCharCode(Number(m));
        plaintext += char;
        log.push(`${c} -> ${c}^${d} mod ${n} = ${m} ('${char}')`);
    }
    return {
        plaintext: plaintext,
        log: log
    };
}
