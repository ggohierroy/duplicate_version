import {
    initializeBlock,
    useBase,
    useRecords,
    Select,
    Input,
    Button,
} from '@airtable/blocks/ui';
import React, {useState} from 'react';

function HelloWorldApp() {
    const base = useBase();
    const versionsTable = base.getTableByName('Versions');
    const records = useRecords(versionsTable);

    const [value, setValue] = useState(records[0].name);
    const [newVersionName, setNewVersionName] = useState('');

    const versions = records.map(record => {
        return (
            { value: record.name, label: record.name}
        );
    });

    // get fields that need to be copied using an exclude list
    const cardAttributesTable = base.getTableByName('Card Attributes');
    let cardAttributeFields = cardAttributesTable.fields
    let exclude = ["Notes/Changelog", "Version"]
    let filteredFields = cardAttributeFields.filter(x => !exclude.includes(x.name) && x.isComputed == false)

    const duplicate = async () => {

        // get the version record that needs to be duplicated
        const versionToDuplicate = records.find(obj => {
            return obj.name === value;
        })

        // new date
        const timeElapsed = Date.now();
        const today = new Date(timeElapsed);

        // create a new version
        const newVersionId = await versionsTable.createRecordAsync({
            'Version Number': newVersionName,
            'Status': {name: 'Draft'},
            'Cycles': versionToDuplicate.getCellValue('Cycles'),
            //'Version Date': today.toLocaleDateString()
        });

        // get the linked card attributes
        const queryResult = versionToDuplicate.selectLinkedRecordsFromCell('Card Attributes');

        // load the data in the query result:
        await queryResult.loadDataAsync();

        // duplicate the Javascript object
        const newRecords = [];
        queryResult.records.forEach(record => {
            let obj = {}

            filteredFields.map(x => {
                Object.assign(obj, {[x.name]: record.getCellValue(x.name)})
            })

            // set the new version
            obj['Version'] = [{id: newVersionId}];

            // set previous version
            obj['Previous Version'] = record.getCellValue('Card Summary [Generated]');

            newRecords.push({ 'fields': obj });
        });

        // create new attributes in batches
        const BATCH_SIZE = 50;
        let i = 0;
        while (i < newRecords.length) {
            const recordBatch = newRecords.slice(i, i + BATCH_SIZE);
            // awaiting the delete means that next batch won't be deleted until the current
            // batch has been fully deleted, keeping you under the rate limit
            await cardAttributesTable.createRecordsAsync(recordBatch);
            i += BATCH_SIZE;
        }

        // when you're done, unload the data:
        queryResult.unloadData();
    }

    return (
        <div>
            <p>Notes: This script expects a Versions table. It will create a new version and set the Name and Status fields. It will duplicate all records in the Card Attributes table associated with the selected version and assign them to the newly created version.</p>
            <div>{base.name}</div>
            <div>Number of versions: {records.length}</div>
            <div>Select version to duplicate:</div>
            <Select
                options={versions}
                value={value}
                onChange={newValue => setValue(newValue)}
                width="320px"
            />
            <div>New version number (e.g., V1, V2, etc.):</div>
            <Input
                value={newVersionName}
                onChange={e => setNewVersionName(e.target.value)}
                placeholder="Version Name"
                width="320px"
            />
            <div>
                <Button onClick={() => duplicate()} icon="edit">
                    Duplicate
                </Button>
            </div>
        </div>
    );
}

initializeBlock(() => <HelloWorldApp />);
