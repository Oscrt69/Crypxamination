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
                <p style="margin: 0; font-size: 14px; word-break: break-all;"><strong>Kunci Jawaban:</strong> <span style="color: #64748b;">${data.encA}</span></p>
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
        const savedResultStr = localStorage.getItem(`examFinished_${activeSubject}_${userEmail}`);
        if (savedResultStr) {
            try {
                const savedData = JSON.parse(savedResultStr);
                // Validasi ciphertext agar jika soal diupdate/dibuat ulang, state usang dihapus
                if (savedData.ciphertext === subjectData.encryptionResult.ciphertext) {
                    encryptedResultData = savedData.results;
                    renderEncryptedResult();
                    return;
                } else {
                    localStorage.removeItem(`examFinished_${activeSubject}_${userEmail}`);
                }
            } catch (e) {
                localStorage.removeItem(`examFinished_${activeSubject}_${userEmail}`);
            }
        }

        // Jangan dekripsi otomatis, tampilkan ciphertext mentahnya ke user
        const cipher = subjectData.encryptionResult.ciphertext;
        
        const container = document.getElementById('exam-questions-container');
        container.innerHTML = `
            <div style="padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; word-break: break-all; color: #64748b; font-size: 13px; font-family: monospace;">
                <strong>Soal Ujian Terenkripsi:</strong><br><br>
                ${cipher}
            </div>
            <p style="margin-top: 15px; font-size: 14px; color: #ef4444; font-weight: 500;">
                Anda belum mendekripsi soal ini. Silakan masukkan Kunci Privat di atas.
            </p>
        `;
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
        localStorage.setItem(`examFinished_${activeSubject}_${userEmail}`, JSON.stringify(dataToSave));
        
        renderEncryptedResult();
    });

    document.getElementById('btn-decrypt-soal')?.addEventListener('click', () => {
        const dVal = document.getElementById('input-decrypt-soal-d').value.trim();
        const nVal = document.getElementById('input-decrypt-soal-n').value.trim();
        const subjectData = subjects[activeSubject];
        
        if (!dVal || !nVal) return alert("Masukkan nilai d dan n terlebih dahulu.");
        
        const cipher = subjectData.encryptionResult.ciphertext;

        try {
            const result = decryptMessage(cipher, dVal, nVal);
            const plaintext = result.plaintext;

            if (plaintext.includes('_=_SEP_ITEM_=_') || plaintext.includes('_=_SEP_QNA_=_')) {
                const items = plaintext.split('_=_SEP_ITEM_=_');
                const container = document.getElementById('exam-questions-container');
                container.innerHTML = '';
                
                currentQuestions = [];
                currentAnswers = [];

                items.forEach((item, i) => {
                    const [q, a] = item.split('_=_SEP_QNA_=_');
                    currentQuestions.push(q);
                    currentAnswers.push(a);

                    const div = document.createElement('div');
                    div.style.marginBottom = '20px';
                    div.style.borderBottom = '1px dashed #cbd5e1';
                    div.style.paddingBottom = '15px';
                    div.innerHTML = `
                        <p style="margin-bottom: 10px; font-weight: 500;">
                            <strong>Soal ${i + 1}:</strong> 
                            <span>${q || '-'}</span>
                        </p>
                        <div>
                            <label style="font-size: 13px; font-weight: 600; color: #475569;">Jawaban Anda:</label>
                            <textarea class="student-answer-input" data-index="${i}" rows="3" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; margin-top: 6px;"></textarea>
                        </div>
                    `;
                    container.appendChild(div);
                });

                // Hide the decrypt question card
                document.getElementById('card-decrypt-soal').style.display = 'none';
                document.getElementById('btn-finish-exam').style.display = 'block';
            } else {
                // Teks terdekripsi tapi delimiter hancur (kunci salah)
                const container = document.getElementById('exam-questions-container');
                container.innerHTML = `
                    <div style="padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px;">
                        <p style="margin: 0; font-size: 13px; font-family: monospace; word-break: break-all; color: #64748b;">
                            ${plaintext}
                        </p>
                    </div>
                `;
            }
        } catch (e) {
            alert("Terjadi kesalahan. Pastikan d dan n berupa angka valid!");
        }
    });

    document.getElementById('btn-decrypt-result').addEventListener('click', () => {
        const dVal = document.getElementById('input-decrypt-result-d').value.trim();
        const nVal = document.getElementById('input-decrypt-result-n').value.trim();
        
        if (!dVal || !nVal) return alert("Masukkan nilai d dan n terlebih dahulu.");

        try {
            const decContainer = document.getElementById('result-decrypted-container');
            decContainer.innerHTML = '<h4 style="margin-top:0;">Hasil Dekripsi</h4>';
            
            let allSuccess = true;

            encryptedResultData.forEach((data, i) => {
                // Decrypt from ciphertext using entered d and n
                const decQ = decryptMessage(data.encQ, dVal, nVal).plaintext;
                const decA = decryptMessage(data.encA, dVal, nVal).plaintext;
                const decSA = decryptMessage(data.encSA, dVal, nVal).plaintext;

                // Validate if it decrypted correctly by checking if it contains English/Indonesian chars (or just match length)
                // For a robust system, if the keys are wrong, it outputs garbage.
                
                const isCorrect = decA.toLowerCase().trim() === decSA.toLowerCase().trim();
                const color = isCorrect ? '#16a34a' : '#ef4444';
                
                const div = document.createElement('div');
                div.style.marginBottom = '15px';
                div.style.padding = '10px';
                div.style.background = 'white';
                div.style.borderRadius = '6px';
                div.style.border = `1px solid ${color}`;
                
                div.innerHTML = `
                    <p style="margin: 0 0 5px 0;"><strong>Soal ${i + 1}:</strong> ${decQ}</p>
                    <p style="margin: 0 0 5px 0; color: #16a34a;"><strong>Kunci Jawaban:</strong> ${decA}</p>
                    <p style="margin: 0; color: ${color};"><strong>Jawaban Anda:</strong> ${decSA}</p>
                `;
                decContainer.appendChild(div);
            });

            decContainer.classList.remove('hidden');
            document.getElementById('card-decrypt-result').style.display = 'none';

        } catch (e) {
            alert("Kunci Privat salah atau bukan angka yang valid!");
        }
    });

    loadState();
});
