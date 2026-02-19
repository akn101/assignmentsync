# Microsoft Teams Assignment API Query Examples

## Original Query (Assigned + Not Complete + Due Before Date)
```
$filter=status eq microsoft.education.assignments.api.educationAssignmentStatus'assigned' and isCompleted eq false and dueDateTime le 2025-09-16T00:27:02.401Z and allTurnedIn eq false
```

## New Query (Assigned + Complete OR Inactive)
```
$filter=( ( status eq microsoft.education.assignments.api.educationAssignmentStatus'assigned' and isCompleted eq true ) or ( status eq microsoft.education.assignments.api.educationAssignmentStatus'inactive' ) )
```

## All Assignments (No Filters)
```
# No $filter parameter - gets everything
```

## Common Parameters
- `$top=20` or `$top=100` - Results per page
- `$orderby=dueDateTime desc` - Sort by due date, newest first
- `$expand=submissions($expand=outcomes),categories,submissionAggregates` - Include related data
- `$skiptoken=...` - Pagination token (auto-generated)

## Status Values Seen
- `assigned` - Active assignments
- `inactive` - Inactive/archived assignments
- `draft` - Draft assignments
- `published` - Published assignments
- `returned` - Returned assignments

## Date Filters
- `dueDateTime le 2025-09-16T00:27:02.401Z` - Due before date
- `dueDateTime ge 2025-01-01T00:00:00Z` - Due after date

## Completion Filters
- `isCompleted eq false` - Not completed
- `isCompleted eq true` - Completed
- `allTurnedIn eq false` - Not all students turned in
- `allTurnedIn eq true` - All students turned in