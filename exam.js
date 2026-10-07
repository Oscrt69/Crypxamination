import { supabase } from './supabaseConfig.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Authentication Check
    const userRole = localStorage.getItem('userRole');
    const userEmail = localStorage.getItem('userEmail');
    
    if (!userRole) {
        window.location.href = "login.html";
        return;
    }
    
    document.getElementById('user-email-display').innerText = `${userEmail} (${userRole})`;

    document.getElementById('btn-back-home').addEventListener('click', () => {
        window.location.href = "index.html";
    });

    // State Variables
    let publicKey = null;
    let privateKey = null;
    let subjects = {};
    let activeSubject = localStorage.getItem('activeExamSubject');

    if (!activeSubject) {
        alert("Tidak ada mata pelajaran yang dipilih.");
        window.location.href = "index.html";
        return;
    }

    document.getElementById('exam-title').innerText = `Mata Pelajaran: ${activeSubject}`;

    // Load State from Supabase / localStorage
    async function loadState() {
        try {
            const { data, error } = await supabase.from('app_state').select('data').eq('id', 1).single();
            let saved = data?.data;
            
            if (!saved || saved === '{}' || (typeof saved === 'object' && Object.keys(saved).length === 0)) {
                saved = localStorage.getItem('crypxaminationState');
            }

            if (saved) {
                let parsed;
                if (typeof saved === 'string') {
                    parsed = JSON.parse(saved, (key, value) => {
                        if (value && typeof value === 'object' && value.__type === 'bigint') {
                            return BigInt(value.value);
                        }
                        return value;
                    });
                } else {
                    parsed = JSON.parse(JSON.stringify(saved), (key, value) => {
                        if (value && typeof value === 'object' && value.__type === 'bigint') {
                            return BigInt(value.value);
                        }
                        return value;
                    });
                }
                
                publicKey = parsed.publicKey;
                privateKey = parsed.privateKey;
                subjects = parsed.subjects;
                
                initExam();
            } else {
                alert("Data ujian tidak ditemukan.");
                window.location.href = "index.html";
            }
        } catch (e) {
            console.error("Gagal memuat state", e);
            alert("Terjadi kesalahan saat memuat data ujian.");
        }
    }

    let currentQuestions = [];
    let currentAnswers = []; // Kunci Jawaban

    function renderEncryptedResult() {
        const resultContainer = document.getElementById('result-encrypted-container');
        resultContainer.innerHTML = '';
        
        encryptedResultData.forEach((data, i) => {
            const div = document.createElement('div');
            div.style.marginBottom = '15px';
            div.style.padding = '10px';
            div.style.background = '#f8fafc';
            div.style.borderRadius = '6px';
            div.style.border = '1px solid #e2e8f0';
            
            div.innerHTML = `
                <p style="margin: 0 0 5px 0; font-size: 14px; word-break: break-all;"><strong>Soal ${i + 1}:</strong> <span style="color: #64748b;">${data.encQ}</span></p>
                <p style="margin: 0 0 5px 0; font-size: 14px; word-break: break-all;"><strong>Kunci Jawaban:</strong> <span style="color: #64748b;">${data.encA}</span></p>
                <p style="margin: 0; font-size: 14px; word-break: break-all;"><strong>Jawaban Anda:</strong> <span style="color: #64748b;">${data.encSA}</span></p>
            `;
            resultContainer.appendChild(div);
        });

        // Swap sections
        document.getElementById('section-exam').style.display = 'none';
        document.getElementById('section-result').style.display = 'block';
    }

    function initExam() {
        const subjectData = subjects[activeSubject];
        if (!subjectData || !subjectData.encryptionResult) {
            alert("Data ujian untuk mata pelajaran ini belum tersedia atau belum dienkripsi.");
            window.location.href = "index.html";
            return;
        }

        // Cek apakah sudah mengerjakan dan ciphertext sama (soal belum diubah)
        const savedResultStr = localStorage.getItem(`examFinished_${activeSubject}`);
        if (savedResultStr) {
            try {
                const savedData = JSON.parse(savedResultStr);
                // Validasi ciphertext agar jika soal diupdate/dibuat ulang, state usang dihapus
                if (savedData.ciphertext === subjectData.encryptionResult.ciphertext) {
                    encryptedResultData = savedData.results;
                    renderEncryptedResult();
                    return;
                } else {
                    localStorage.removeItem(`examFinished_${activeSubject}`);
                }
            } catch (e) {
                localStorage.removeItem(`examFinished_${activeSubject}`);
            }
        }

        // We decrypt the exam using privateKey to show to the student
        const cipher = subjectData.encryptionResult.ciphertext;
        try {
            const result = decryptMessage(cipher, privateKey.d, privateKey.n);
            const plaintext = result.plaintext;
            
            if (plaintext.includes('|') || plaintext.includes('@')) {
                const items = plaintext.split('|');
                const container = document.getElementById('exam-questions-container');
                container.innerHTML = '';
                
                items.forEach((item, i) => {
                    const [q, a] = item.split('@');
                    currentQuestions.push(q);
                    currentAnswers.push(a);

                    const div = document.createElement('div');
                    div.style.marginBottom = '20px';
                    div.style.borderBottom = '1px dashed #cbd5e1';
                    div.style.paddingBottom = '15px';
                    div.innerHTML = `
                        <p style="margin-bottom: 10px; font-weight: 500;"><strong>Soal ${i + 1}:</strong> ${q || '-'}</p>
                        <div>
                            <label style="font-size: 13px; font-weight: 600; color: #475569;">Jawaban Anda:</label>
                            <textarea class="student-answer-input" data-index="${i}" rows="3" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; margin-top: 6px;"></textarea>
                        </div>
                    `;
                    container.appendChild(div);
                });
            }
        } catch(e) {
            alert("Gagal mendekripsi data ujian.");
            console.error(e);
        }
    }

    let encryptedResultData = [];

    document.getElementById('btn-finish-exam').addEventListener('click', () => {
        if (!confirm("Apakah Anda yakin ingin menyelesaikan ujian?")) return;

        const inputs = document.querySelectorAll('.student-answer-input');
        const studentAnswers = [];
        inputs.forEach(input => {
            const val = input.value.trim();
            studentAnswers.push(val === "" ? "kosong" : val);
        });

        encryptedResultData = [];

        // Generate the encrypted result views
        const resultContainer = document.getElementById('result-encrypted-container');
        resultContainer.innerHTML = '';
        encryptedResultData = [];

        currentQuestions.forEach((q, i) => {
            const a = currentAnswers[i];
            const sa = studentAnswers[i];

            // Encrypt each individually
            const encQ = encryptMessage(q, publicKey.e, publicKey.n).ciphertext;
            const encA = encryptMessage(a, publicKey.e, publicKey.n).ciphertext;
            const encSA = encryptMessage(sa, publicKey.e, publicKey.n).ciphertext;

            encryptedResultData.push({
                q: q, a: a, sa: sa,
                encQ: encQ, encA: encA, encSA: encSA
            });
        });

        // Simpan state telah selesai beserta identifikasi ciphertext soal
        const dataToSave = {
            ciphertext: subjects[activeSubject].encryptionResult.ciphertext,
            results: encryptedResultData
        };
        localStorage.setItem(`examFinished_${activeSubject}`, JSON.stringify(dataToSave));
        
        renderEncryptedResult();
    });

    document.getElementById('btn-decrypt-result').addEventListener('click', () => {
        const pwd = document.getElementById('input-decrypt-password').value.trim();
        const subjectData = subjects[activeSubject];
        
        if (!pwd) return alert("Masukkan kata sandi terlebih dahulu.");
        if (!subjectData.password) return alert("Guru belum mengatur kata sandi untuk mata pelajaran ini.");
        
        if (pwd !== subjectData.password) {
            return alert("Kata sandi salah!");
        }

        // Correct password
        const decContainer = document.getElementById('result-decrypted-container');
        decContainer.innerHTML = '<h4 style="margin-top:0;">Hasil Dekripsi</h4>';
        
        encryptedResultData.forEach((data, i) => {
            const isCorrect = data.a.toLowerCase().trim() === data.sa.toLowerCase().trim();
            const color = isCorrect ? '#16a34a' : '#ef4444';
            
            const div = document.createElement('div');
            div.style.marginBottom = '15px';
            div.style.padding = '10px';
            div.style.background = 'white';
            div.style.borderRadius = '6px';
            div.style.border = `1px solid ${color}`;
            
            div.innerHTML = `
                <p style="margin: 0 0 5px 0;"><strong>Soal ${i + 1}:</strong> ${data.q}</p>
                <p style="margin: 0 0 5px 0; color: #16a34a;"><strong>Kunci Jawaban:</strong> ${data.a}</p>
                <p style="margin: 0; color: ${color};"><strong>Jawaban Anda:</strong> ${data.sa}</p>
            `;
            decContainer.appendChild(div);
        });

        decContainer.classList.remove('hidden');
    });

    loadState();
});
