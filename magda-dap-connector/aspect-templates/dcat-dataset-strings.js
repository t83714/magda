var moment = libraries.moment;
var dap = libraries.dap;

return {
    title: dataset.title || dataset.name,
    description: dataset.description,
    issued: dataset.published
        ? moment.utc(dataset.published).format()
        : undefined,
    modified:  undefined,
    languages: ['English'],
    publisher: 'CSIRO',
    accrualPeriodicity: '',
    spatial: '',
    temporal: {
        start: dataset.dataStartDate,
        end: dataset.dataEndDate
    },
    themes: dataset.fieldOfResearch || [],
    keywords: dataset.keywords?dataset.keywords.split(";"):[],
    contactPoint: dataset.attributionStatement,
    landingPage: dataset.landingPage.href
};
