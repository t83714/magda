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
    publisher: 'CSIRO (Australia)',
    accrualPeriodicity: '',
    spatial: '',
    temporal: {
        start: dataset.dataStartDate,
        end: dataset.dataEndDate
    },
    themes: dataset.fieldOfResearch || [],
    keywords: [],
    contactPoint: '',
    landingPage: dataset.landingPage.href
};
