// ============================================================================
// 🚀 [ZenNotes V3] 마이그레이션 및 샌드박스 테스트 엔진
// (이 파일은 V3 업데이트가 완전히 안정화된 후 다음 버전에서 삭제될 임시 스크립트입니다.)
// ============================================================================

async function runV3MigrationTest() {
    if (!gapiInited || !gapi.client || gapi.client.getToken() === null) {
        alert("구글 클라우드에 연결되어 있지 않습니다. 먼저 우측 상단의 구름 아이콘을 눌러 로그인해 주세요.");
        return;
    }

    const token = gapi.client.getToken().access_token;
    showToast("🚀 V3 마이그레이션 테스트 시작...\n(구글 드라이브에 전용 폴더를 생성합니다.)");

    try {
        // 1. 구글 드라이브에 V3 전용 폴더(ZenNotes_Sync_Data) 찾기 또는 만들기
        let folderId = await getOrCreateSyncFolder(token);
        if (!folderId) throw new Error("폴더 생성 실패");

        // 2. 로컬 DB에서 모든 데이터 읽어오기 (안전을 위해 읽기 전용으로 접근)
        const allData = await new Promise((resolve) => {
            db.transaction(["memos"], "readonly").objectStore("memos").getAll().onsuccess = (e) => {
                resolve(e.target.result);
            };
        });

        // 3. V3 아키텍처에 맞게 데이터 쪼개기 (명부 vs 개별 본문)
        const indexData = [];
        const filesToUpload = [];

        allData.forEach(memo => {
            // [A] index.json에 들어갈 가벼운 껍데기(메타데이터) 정보
            const meta = { ...memo };
            delete meta.content;    // 무거운 본문 삭제
            delete meta.plainText;  // 무거운 텍스트 삭제
            indexData.push(meta);

            // [B] 개별 파일로 저장할 무거운 본문 데이터 (폴더는 본문이 없으므로 제외)
            if (memo.type !== 'folder') {
                filesToUpload.push({
                    name: `memo_${memo.syncId}.json`,
                    content: JSON.stringify({
                        syncId: memo.syncId,
                        content: memo.content || "",
                        plainText: memo.plainText || ""
                    })
                });
            }
        });

        // 4. 가벼운 명부(index.json) 먼저 업로드
        showToast("📦 index.json (전체 목록) 업로드 중...");
        await uploadFileToDrive(token, 'index.json', JSON.stringify(indexData), folderId);

        // 5. 개별 노트 파일들 순차적 업로드 (구글 서버 차단 방지를 위해 0.3초 딜레이)
        showToast(`총 ${filesToUpload.length}개의 노트를 개별 파일로 쪼개서 업로드합니다...\n(앱을 끄지 마세요)`);

        for (let i = 0; i < filesToUpload.length; i++) {
            const file = filesToUpload[i];
            await uploadFileToDrive(token, file.name, file.content, folderId);

            // 5개마다 진행 상황을 콘솔에 찍어줍니다.
            if ((i + 1) % 5 === 0 || i === filesToUpload.length - 1) {
                console.log(`>>> [마이그레이션] 업로드 진행 중... (${i + 1}/${filesToUpload.length})`);
            }

            // 구글 트래픽 제한(Rate Limit) 방어막: 0.3초 대기
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        showToast("🎉 [테스트 완료]\n구글 드라이브에 접속해서 'ZenNotes_Sync_Data' 폴더가 잘 만들어졌는지 확인해 보세요!");

    } catch (error) {
        console.error(">>> [마이그레이션 에러]:", error);
        showToast("❌ 테스트 중 오류가 발생했습니다. (콘솔 확인)");
    }
}

// ----------------------------------------------------------------------------
// 🛠️ 구글 API 헬퍼 함수들 (마이그레이션 전용)
// ----------------------------------------------------------------------------

// 폴더 ID를 찾거나 새로 만드는 함수
async function getOrCreateSyncFolder(token) {
    const folderName = 'ZenNotes_Sync_Data';

    // 1. 먼저 폴더가 있는지 검색
    const res = await gapi.client.drive.files.list({
        q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: "files(id, name)"
    });

    if (res.result.files && res.result.files.length > 0) {
        return res.result.files[0].id; // 이미 있으면 그 폴더의 ID 반환
    }

    // 2. 없으면 새로 생성
    const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['root']
    };

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });

    const createdFolder = await createRes.json();
    return createdFolder.id;
}

// 지정된 폴더 안에 파일을 생성(또는 덮어쓰기)하는 함수
async function uploadFileToDrive(token, fileName, fileContent, parentFolderId) {
    // 1. 해당 폴더 안에 똑같은 이름의 파일이 이미 있는지 검사
    const res = await gapi.client.drive.files.list({
        q: `name = '${fileName}' and '${parentFolderId}' in parents and trashed = false`,
        fields: "files(id)"
    });

    const file = res.result.files ? res.result.files[0] : null;

    if (file) {
        // 이미 있으면 PATCH로 내용만 덮어쓰기
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: fileContent
        });
    } else {
        // 없으면 POST로 새로 만들기
        const metadata = {
            name: fileName,
            mimeType: 'application/json',
            parents: [parentFolderId]
        };
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const close_delim = `\r\n--${boundary}--`;

        const body = delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            fileContent +
            close_delim;

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: body
        });
    }
}